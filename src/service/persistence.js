const JiraApi = require('jira-client');
const config = require('config')
const {createComment, mapFieldsToDescription} = require("./jiraMessages");

const systemUser = config.get('secrets.cftptl-intsvc.jira-username')

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
    const user = convertEmail(email)

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
    const viewOnJiraText = blocks[4].elements[0].text // TODO make this less fragile

    return extractJiraId(viewOnJiraText)
}

function extractJiraId(text) {
    return extractProjectRegex.exec(text)[1]
}

function convertEmail(email) {
    if (!email) {
        return systemUser
    }

    return email.split('@')[0]
}

async function createHelpRequestInJira(requestType, summary, project) {
    return await jira.addNewIssue({
        fields: {
            summary: summary,
            issuetype: {
                id: getIssueTypeId(requestType)
            },
            project: {
                id: project.id
            },
            description: undefined,
            customfield_24700: [ { value: "No Environment" } ], // Environment - TODO Make this configurable and select appropriate value based on selection
        }
    });
}

async function createHelpRequest(requestType, summary) {

    const project = await jira.getProject(getJiraProject(requestType))

    // https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post
    // note: fields don't match 100%, our Jira version is a bit old (still a supported LTS though)
    let result = await createHelpRequestInJira(requestType, summary, project);
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
            labels: ['created-from-slack', ...labels],
            fixVersions: [ { name: "CCD No Release Required" } ], // TODO Make this configurable
            components: [ { name: "No Component" } ]
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

module.exports.resolveHelpRequest = resolveHelpRequest
module.exports.startHelpRequest = startHelpRequest
module.exports.assignHelpRequest = assignHelpRequest
module.exports.createHelpRequest = createHelpRequest
module.exports.updateHelpRequestDescription = updateHelpRequestDescription
module.exports.updateHelpRequestCommonFields = updateHelpRequestCommonFields
module.exports.addCommentToHelpRequest = addCommentToHelpRequest
module.exports.convertEmail = convertEmail
module.exports.extractJiraId = extractJiraId
module.exports.extractJiraIdFromBlocks = extractJiraIdFromBlocks
module.exports.searchForUnassignedOpenIssues = searchForUnassignedOpenIssues
