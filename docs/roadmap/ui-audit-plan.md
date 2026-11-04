This phase is about auditing user journey in terms of usability, conversion and stickiness. 

Work on member-home-stickiness branch locally setup. This should have the latest changes in terms of building the unauthenticated experience and authenticated experience.

Setup fully agentic environment. 
Create a folder called docs/userjourney.

The platform admin agent will assume the role of platorm admin. This agent is responsbile for approving other agents ability to join the platform. 
Spin as many other agents as needed for each possible combination of user cohort and feature. For eg- unauthenticated user signs up and creates a default space will be an automation testing agent. This agent will go through the experinece and output the user journey document in the docs/userjourney. 
Whereever approvals are needed the the platform admin agent will approve and deny and capture the two journeys as needed.
No need to capture the initial unauth journey of answering today's questions etc.
User journeys can be stopped as soon as they land on a space and try to use a feature such as join a quest or start an assessment. Actual quest and assessment journey is not needed.
Load render-report skills from UX skill set.
Each userjourney document should idenfity screenshots of what that user cohort would notice.
Load another agent with frontend-design skill and wait for other cohort users agents are done recording all user journeys and audit the workflows for consistency, color themes, usability.
Also, since this portal and plaform is developed over a large number of phases, check for redundant and inconsistent workflows. Eg - tutor recording a session etc.
Build recommendations. 

The platform console journey is not relevat for audit. Its the external user signups, stickiness and usability of the platform for that user is most critical for this phase.
When executing multi agent setup, provide 15 min statuses on which journey is currently being recorded etc.