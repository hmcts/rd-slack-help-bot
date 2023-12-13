const { convertIso8601ToEpochSeconds } = require('./dateHelper');

function convertJiraKeyToUrl(jiraId) {
    return `https://tools.hmcts.net/jira/browse/${jiraId}`;
}

const slackLinkRegex = /view in Slack\|(https:\/\/.+slack\.com.+)]/

function extractSlackLinkFromText(text) {
    if (text === undefined) {
        return undefined
    }

    const regexResult = slackLinkRegex.exec(text);
    if (regexResult === null) {
        return undefined
    }
    return regexResult[1]
}

function stringTrim(string, maxLength) {
    const truncationMessage = '... [Truncated] see Jira for rest of message.';

    if (string.length >= maxLength) {
        return string.slice(0, maxLength - truncationMessage.length).concat(truncationMessage);
    } else {
        return string;
    }
}

function helpRequestRaised({
                               user,
                               summary,
                               priority,
                               environment,
                               references,
                               jiraId
                           }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*${summary}*`,
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Status* :fire:  \n Open"
                },
                {
                    "type": "mrkdwn",
                    "text": `*Priority* :rotating_light: \n ${priority}`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Reporter* :man-surfing: \n <@${user}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Environment* :house_with_garden: \n ${environment}`
                }
            ]
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*Jira/ServiceNow references* :pencil: \n${references}`
                }
            ]
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `View on Jira: <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`
                }
            ]
        },
        {
            "type": "divider"
        },
        {
            "type": "actions",
            "block_id": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Unassigned",
                        "emoji": true
                    },
                    "action_id": "assign_help_request_to_user"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":raising_hand: Take it",
                        "emoji": true
                    },
                    "style": "primary",
                    "value": "assign_help_request_to_me",
                    "action_id": "assign_help_request_to_me"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":female-firefighter: Start",
                        "emoji": true
                    },
                    "style": "primary",
                    "value": "start_help_request",
                    "action_id": "start_help_request"
                }
            ]
        },
        {
            "type": "divider"
        }
    ]
}

function helpRequestDetails(
    {
        description,
        analysis
    }) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": stringTrim(`:spiral_note_pad: Description: ${description}`, 3000),
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": stringTrim(`:thinking_face: Analysis: ${analysis}`, 3000),
            }
        },
    ]
}

function unassignedOpenIssue({
                                 summary,
                                 slackLink,
                                 jiraId,
                                 created,
                                 updated
                             }) {
    const link = slackLink ? slackLink : convertJiraKeyToUrl(jiraId)

    return [
        {
            "type": "divider"
        },
        {
            "type": "section",
            "block_id": `${jiraId}_link`,
            "text": {
                "type": "mrkdwn",
                "text": `*<${link}|${summary}>*`
            },
        },
        {
            "type": "actions",
            "block_id": `${jiraId}_actions`,
            "elements": [
                {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Assign to",
                        "emoji": true
                    },
                    "action_id": "app_home_unassigned_user_select"
                },
                {
                    "type": "button",
                    "action_id": "app_home_take_unassigned_issue",
                    "text": {
                        "type": "plain_text",
                        "text": ":raising_hand: Take it"
                    },
                    "style": "primary"
                }
            ]
        },
        {
            "type": "section",
            "block_id": `${jiraId}_fields`,
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*:alarm_clock: Opened:*\n <!date^${convertIso8601ToEpochSeconds(created)}^{date_pretty} ({time})|${created}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*:hourglass: Last Updated:*\n <!date^${convertIso8601ToEpochSeconds(updated)}^{date_pretty} ({time})|${updated}>`
                },
                {
                    "type": "mrkdwn",
                    "text": `*View on Jira*:\n <${convertJiraKeyToUrl(jiraId)}|${jiraId}>`
                }
            ]
        },
        ]
}

function appHomeUnassignedIssues(openIssueBlocks) {
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Open unassigned issues*"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Unassigned open issues",
                        "emoji": true
                    },
                    "value": "unassigned_open_issues",
                    "action_id": "unassigned_open_issues"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "My issues",
                        "emoji": true
                    },
                    "value": "my_issues",
                    "action_id": "my_issues"
                }
            ]
        },
        ...openIssueBlocks
    ]
}

function option(name, option) {
    return {
        text: {
            type: "plain_text",
            text: name,
            emoji: true
        },
        value: option ?? name.toLowerCase()
    }
}

function openHelpRequestBlocks() {
    return {
        "title": {
            "type": "plain_text",
            "text": "Support request"
        },
        "submit": {
            "type": "plain_text",
            "text": "Submit"
        },
        "blocks": [
            {
                "type": "input",
                "block_id": "request_type",
                "element": {
                    "type": "radio_buttons",
                    "options": [
                        option('CCD Support', 'ccd'),
                        option('CFTS Level 2 Support', 'cfts'),
                    ],
                    "action_id": "request_type"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Request type"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "input",
                "block_id": "summary",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "title",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Short description of the issue"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Issue summary"
                }
            },
            {
                "type": "input",
                "block_id": "priority",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Standard priority classification",
                        "emoji": true
                    },
                    "options": [
                        option('Highest'),
                        option('High'),
                        option('Medium'),
                        option('Low'),
                    ],
                    "action_id": "priority"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Priority",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "references",
                "optional": true,
                "element": {
                    "type": "plain_text_input",
                    "action_id": "title",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Any relevant ticket references"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Jira/ServiceNow references"
                }
            },
            {
                "type": "input",
                "block_id": "environment",
                "optional": true,
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Choose an environment",
                        "emoji": true
                    },
                    "options": [
                        option('AAT / Staging', 'staging'),
                        option('Preview / Dev', 'dev'),
                        option('Production'),
                        option('Perftest / Test', 'test'),
                        option('Demo'),
                        option('Demo INT', 'demo-int'),
                        option('WA INT', 'wa-int'),
                        option('ITHC'),
                        option('N/A', 'none'),
                    ],
                    "action_id": "environment"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Environment",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "description",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "description"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Issue description",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "analysis",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "analysis"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Analysis done so far",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "team",
                "element": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select other if missing",
                        "emoji": true
                    },
                    "options": [
                        option('Access Management', 'am'),
                        option('Architecture'),
                        option('Bulk scan', 'bulkscan'),
                        option('Bulk print', 'bulkprint'),
                        option('CCD'),
                        option('Civil Damages', 'civildamages'),
                        option('Civil Unspecified', 'CivilUnspec'),
                        option('CMC'),
                        option('Divorce'),
                        option('Domestic Abuse', "domesticabuse"),
                        option('No fault divorce', 'nfdivorce'),
                        option('Employment Tribunals', 'et'),
                        option('Evidence Management', 'evidence'),
                        option('Expert UI', 'xui'),
                        option('Financial Remedy', 'finrem'),
                        option('FPLA'),
                        option('Family Private Law', 'FPRL'),
                        option('Family Public Law', 'FPL'),
                        option('Heritage'),
                        option('HMI'),
                        option('Management Information', 'mi'),
                        option('Immigration and Asylum', 'iac'),
                        option('IDAM'),
                        option('Other'),
                        option('Probate'),
                        option('Reference Data', 'refdata'),
                        option('Reform Software Engineering', 'reform-software-engineering'),
                        option('Security Operations or Secure design', 'security'),
                        option('SSCS'),
                        option('PayBubble'),
                        option('PET'),
                        option('Work Allocation', 'workallocation'),
                    ],
                    "action_id": "team"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Which team are you from?",
                    "emoji": true
                }
            }
        ],
        "type": "modal",
        "callback_id": "create_help_request"
    }
}

module.exports.appHomeUnassignedIssues = appHomeUnassignedIssues;
module.exports.unassignedOpenIssue = unassignedOpenIssue;
module.exports.helpRequestRaised = helpRequestRaised;
module.exports.helpRequestDetails = helpRequestDetails;
module.exports.openHelpRequestBlocks = openHelpRequestBlocks;
module.exports.extractSlackLinkFromText = extractSlackLinkFromText;
