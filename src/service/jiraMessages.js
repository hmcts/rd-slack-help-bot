function optionalField(prefix, value) {
  if (value) {
      return `*${prefix}*: ${value}`
  }
  return ""
}

function mapFieldsToDescription(
  {
      references,
      environment,
      description,
      analysis,
      slackLink
  }) {
  return `
h6. _This is an automatically generated ticket created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

${optionalField('Jira/ServiceNow references', references)}


${optionalField('Environment', environment)}

*Issue description*

${description}

*Analysis done so far*: ${analysis}
`
}

function createComment({slackLink, displayName, message}) {
return `
h6. _This is an automatically added comment created from Slack, do not reply or update in here, [view in Slack|${slackLink}]_

h6. ${displayName}:
${message}
`
}

module.exports.mapFieldsToDescription = mapFieldsToDescription
module.exports.createComment = createComment
