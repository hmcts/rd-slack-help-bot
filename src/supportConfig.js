
const config = require('config');

const supportConfig = {
    rd: {
        reportChannel: config.get('slack.report_channel'),
        reportChannelId: config.get('slack.report_channel_id'),
        jiraProject: config.get('jira.project'),
        issueTypeId: config.get('jira.issue_type_id'),
        issueTypeName: config.get('jira.issue_type_name')
    }
}

const extractProjectRegex = new RegExp(`((${getJiraProjects().join('|')})-[\\d]+)`)

function getReportChannel(requestType) {
    return supportConfig[requestType].reportChannel
}

function getJiraProject(requestType) {
    return supportConfig[requestType].jiraProject
}

function getIssueTypeId(requestType) {
    return supportConfig[requestType].issueTypeId
}

function getJiraStartTransitionId(requestType) {
    return supportConfig[requestType].jiraStartTransitionId
}

function getJiraDoneTransitionId(requestType) {
    return supportConfig[requestType].jiraDoneTransitionId
}

function isReportChannel(channelId) {
    return getConfigKeys().find(key => supportConfig[key].reportChannelId === channelId) != undefined
}

function getJiraProjects() {
    return getConfigKeys().map(key => supportConfig[key].jiraProject)
}

function getIssueTypeNames() {
    return getConfigKeys().map(key => supportConfig[key].issueTypeName)
}

function getConfigKeys() {
    return Object.keys(supportConfig)
}

function getRequestTypeFromJiraId(jiraId) {
    const jiraProject = extractJiraProject(jiraId)
    return getRequestTypeFromJiraProject(jiraProject)
}

function getRequestTypeFromJiraProject(jiraProject) {
    return getConfigKeys().find(key => supportConfig[key].jiraProject === jiraProject)
}

function extractJiraProject(text) {
    return extractProjectRegex.exec(text)[2]
}

module.exports.extractProjectRegex = extractProjectRegex
module.exports.getRequestTypeFromJiraId = getRequestTypeFromJiraId
module.exports.getReportChannel = getReportChannel
module.exports.isReportChannel = isReportChannel
module.exports.getJiraProjects = getJiraProjects
module.exports.getJiraProject = getJiraProject
module.exports.getIssueTypeNames = getIssueTypeNames
module.exports.getIssueTypeId = getIssueTypeId
module.exports.getJiraStartTransitionId = getJiraStartTransitionId
module.exports.getJiraDoneTransitionId = getJiraDoneTransitionId
