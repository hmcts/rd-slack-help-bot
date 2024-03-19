const JiraApi = require('jira-client');
const config = require('config')
const {createComment, mapFieldsToDescription, createResolveComment} = require("./jiraMessages");

const systemUser = config.get('jira.username')

const issueTypeId = config.get('jira.issue_type_id')
const issueTypeName = config.get('jira.issue_type_name')

const jiraProject = config.get('jira.project')

const jiraStartTransitionId = config.get('jira.start_transition_id')
const jiraDoneTransitionId = config.get('jira.done_transition_id')
// const extractProjectRegex = new RegExp(`(${jiraProject}-[\\d]+)`)

const { 
    extractProjectRegex,
    getRequestTypeFromJiraId,
    getJiraProjects,
    getIssueTypeNames,
    getIssueTypeId,
    getJiraProject,
    getJiraStartTransitionId,
    getJiraDoneTransitionId
} = require('../supportConfig');

const jira = new JiraApi({
    protocol: 'https',
    host: 'tools.hmcts.net/jira',
    bearer: config.get('secrets.cftptl-intsvc.jira-api-token'),
    apiVersion: '2',
    strictSSL: true
});

async function resolveHelpRequest(jiraId) {
    try {
        const requestType = getRequestTypeFromJiraId(jiraId)
        await jira.transitionIssue(jiraId, {
            transition: {
                id: getJiraDoneTransitionId(requestType)
            }
        })
    } catch (err) {
        console.log("Error resolving help request in jira", err)
    }
}

async function markAsDuplicate(jiraIdToUpdate, parentJiraId) {
    try {
        await jira.issueLink({
            type: {
                name: "Duplicate"
            },
            inwardIssue: {
                key: jiraIdToUpdate
            },
            outwardIssue: {
                key: parentJiraId
            },
        });

        await jira.transitionIssue(jiraIdToUpdate, {
            transition: {
                id: jiraDoneTransitionId
            }
        })
    } catch (err) {
        console.log("Error marking help request as duplicate in jira", err)
    }
}


async function startHelpRequest(jiraId) {
    try {
        const requestType = getRequestTypeFromJiraId(jiraId)
        await jira.transitionIssue(jiraId, {
            transition: {
                id: getJiraStartTransitionId(requestType)
            }
        })
    } catch (err) {
        console.log("Error starting help request in jira", err)
    }
}

async function getIssueDescription(issueId) {
    try {
        const issue = await jira.getIssue(issueId, 'description');
        return issue.fields.description;
    } catch(err) {
        if (err.statusCode === 404) {
            return undefined;
        } else {
            throw err
        }

    }
}

async function searchForUnassignedOpenIssues() {
    const projects = getJiraProjects().join(', ')
    const issueTypes = getIssueTypeNames().map(name => `"${name}"`).join(', ')
    const jqlQuery = `project in (${projects}) AND type in (${issueTypes}) AND status in ("Draft", "To Do") and assignee is EMPTY ORDER BY created ASC`;
    try {
        return await jira.searchJira(
            jqlQuery,
            {
                // TODO if we moved the slack link out to another field we wouldn't need to request the whole description
                // which would probably be better for performance
                fields: ['created', 'description', 'summary', 'updated']
            }
        )
    } catch (err) {
        console.log("Error searching for issues in jira", err)
        return {
            issues: []
        }
    }
}

async function assignHelpRequest(issueId, email) {
    const user = await convertEmail(email)

    try {
        await jira.updateAssignee(issueId, user)
    } catch(err) {
        console.log("Error assigning help request in jira", err)
    }
}

/**
 * Extracts a jira ID
 *
 * expected format: 'View on Jira: <https://tools.hmcts.net/jira/browse/SBOX-61|SBOX-61>'
 * @param blocks
 */
function extractJiraIdFromBlocks(blocks) {
    let viewOnJiraText
    if (blocks.length === 3) {
        viewOnJiraText = blocks[2].fields[0].text
    } else {
        viewOnJiraText = blocks[4].elements[0].text
    }

    project = extractProjectRegex.exec(viewOnJiraText);

    return (project) ? project[1] : 'undefined';
}

function extractJiraId(text) {
    return extractProjectRegex.exec(text)[1]
}

async function convertEmail(email) {
    if (!email) {
        return systemUser
    }

    try {
        res = await jira.searchUsers(options = {
            username: email,
            maxResults: 1
        })

        return res[0].name
    } catch(ex) {
        console.log("Querying username failed: " + ex)
        return systemUser
    }
}

async function createHelpRequestInJira(requestType, summary, project, user, labels) {
    console.log(`Creating help request in Jira for user: ${user}`)
    const issue = await jira.addNewIssue({
        fields: {
            summary: summary,
            issuetype: {
                id: getIssueTypeId(requestType)
            },
            project: {
                id: project.id
            },
            labels: ['created-from-slack', ...labels],
            description: undefined,
            reporter: {
                name: user // API docs say ID, but our jira version doesn't have that field yet, may need to change in future
            },
            customfield_10007: 10029, // sprint
            customfield_10008: "RWA-695" // epic
        }
    });

    try {
        await jira.transitionIssue(issue.key, {
            transition: {
                id: "141" // Move to "To be Refined"
            }
        })
    } catch (err) {
        console.log("Unable to transition new issue", err)
    }

    return issue;
}

async function createHelpRequest(requestType, summary, userEmail, labels) {
    const user = await convertEmail(userEmail)

    const project = await jira.getProject(getJiraProject(requestType))

    // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
    // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)
//    let result = await createHelpRequestInJira(requestType, summary, project);
    let result
    try {
        result = await createHelpRequestInJira(summary, project, user, labels);
    } catch(err) {
        // in case the user doesn't exist in Jira use the system user
        result = await createHelpRequestInJira(summary, project, systemUser, labels);

        if (!result.key) {
            console.log("Error creating help request in jira", JSON.stringify(result));
        }
    }

    return result.key
}

async function updateHelpRequestCommonFields(issueId, { userEmail, labels }) {
    const user = convertEmail(userEmail)
    
    try {
        await jira.updateIssue(issueId, buildFieldsForUpdate(user, labels))
    } catch(err) {
        await jira.updateIssue(issueId, buildFieldsForUpdate(systemUser, labels))
    }
}

function buildFieldsForUpdate(reporter, labels) {
    return {
        fields: {
            reporter: {
                name: reporter // API docs say ID, but our jira version doesn't have that field yet, may need to change in future
            },
            labels: ['created-from-slack', ...labels]
        }
    }
}

async function updateHelpRequestDescription(issueId, fields) {
    const jiraDescription = mapFieldsToDescription(fields);
    try {
        await jira.updateIssue(issueId, {
            update: {
                description: [{
                    set: jiraDescription
                }]
            }
        })
    } catch(err) {
        console.log("Error updating help request description in jira", err)
    }
}

async function addCommentToHelpRequest(externalSystemId, fields) {
    try {
        await jira.addComment(externalSystemId, createComment(fields))
    } catch (err) {
        console.log("Error creating comment in jira", err)
    }
}

async function addCommentToHelpRequestResolve(externalSystemId, { what, where, how} ) {
    try {
        await jira.addComment(externalSystemId, createResolveComment({what, where, how}))
    } catch (err) {
        console.log("Error creating comment in jira", err)
    }
}

async function addLabel(externalSystemId, { category} ) {
    try {
        await jira.updateIssue(externalSystemId, {
            update: {
                labels: [{
                    add: `resolution-${category.toLowerCase().replaceAll(' ', '-')}`
                }]
            }
        })
    } catch(err) {
        console.log("Error updating help request description in jira", err)
    }
}


module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.startHelpRequest = startHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.updateHelpRequestCommonFields = updateHelpRequestCommonFields
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.addCommentToHelpRequestResolve = addCommentToHelpRequestResolve
module.exports.addLabel = addLabel
module.exports.convertEmail = convertEmail
module.exports.extractJiraId = extractJiraId
module.exports.extractJiraIdFromBlocks = extractJiraIdFromBlocks
module.exports.searchForUnassignedOpenIssues = searchForUnassignedOpenIssues
module.exports.getIssueDescription = getIssueDescription
module.exports.markAsDuplicate = markAsDuplicate
