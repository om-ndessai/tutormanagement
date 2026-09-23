This document details the phased development of the portal.

Phase 1: 
The goal of this phase is to enable google social login. This would be the only way for users to login. The main page will have Google social login option. Upon clicking it will trigger gmail login. Upon successful authentication, it will bring a page with details from the users table matching the email id of the google login. 

Build it in a way so that it can be disabled for next phases - to enable testing without any authentication. In the later phases, I will reenable the social login.

Another output expected is a document on setting this up in google.

Phase 2:
The goal of this phase is to finalize the data model for users, build the RD1 database and run the necessary scripts to build the database. In all these phases, there is no need to do any migration since this is a greenfield project. If any data model needs to be updated, delete all tables and recreate.

The portal will be used by following types of users. 
Admins - these are owners of the institute or people with admin access. Only this user can add a new user into the system.
Tutors - users who offer tutoring services. 
Students - users who are enrolled for tutoring. 
Parents - users who are responsible for costs and communicating and monitoring the classes and schedule.

At this point, we will only allow gmail based userids since in the later phase google based social login will be the only way of login into this portal.

A user can have multiple roles. A parent can be a tutor, admin can be a tutor. A tutor could also be a student tutoring lower grades.

All these entities are users in the system.
Users must have following attributes: Full Name, Email, Phone, Active
Tutors must have following data: Highest education, it could also be currently enrolled grade or math course. 
School, Location - area. We are not recording real address yet. General availability - can select days of the week and hour at which available. Notes - where tutors can enter availability note. Availability for virtual tutoring. Tutor also must have zelle or venmo id for payments. A tutor can also have a parent relationship.
Stuents must support following data: School. Currently enrolled math course/grade. Goal for the current academic year. Day of the week availability as well availability for virtual tutoring. 
Parents: Support recording zelle or venmo id for requesting payment. A student must have atleast one parent relationship. Parent may or may not have a student assigned. 

Phase 3:
This phase is about building user audit. Each user activity needs to be recorded in a user audit system. This needs to have a timestamp, the userid and brief description of what action was performed. Within each profile, a run down of the activity should be visible. Admin should have ability to see the user activity within the entire system as well as for inidividual user.

Phase 4:
Portal enhancement for Tutors. This phase will make enhancements for tutors. Only admins can add another user. A parent must be created before a student can be created. And admin can assign student to tutors.

A tutor will have a default hourly rate. The rate can be different for in person vs virtual. The system should also allow variable rate for each student/tutor relation. Admin, when assigning a student to the tutor can specify the hourly rate.

After each session, the tutor will record that session was held. Will specify the start / end time. Come up with intuitive way of recording start/end time and calculate the session time by rounding to 15 min interval. Eg- session times will be like 1hr, 1hr 15 mins, 1hr 30 mins and so on. The tutor will also need ability to enter notes of the session - could include feedback, track towards the goal, session assessment, home work etc. 

After the session details are saved, the amount for the session will be calculated and saved. This will drive the billables for the session and will help the admin to keep track of amount the tutor has earned.

Phase 5: 
Payment enhancements. No actual payments will be made through the portal. Its only to keep track of what a tutor owns and let admin record when the payment was received from the parent and when the payment was made tot he tutor. The payments should allow recording date time, amount, for which student if the payment is coming from parent etc. Balances need to be supported for parents as well as tutors. The payment form need to be supported are venmo, zelle, cash, check. 

Phase 6:
This phase is about thourough end-to-end testing. For each testing session, wipe out the database and rebuild through automation testing. Iterate through to make changes to the data model, api, ui etc till the goals described in above phases are achieved.
I want to use playwright for testing. Use the production site/url, DB for testing. Disable authentication during the testing. 
The goal for this phase is to confirm end-to-end workflows for different types of users. Launch portal as a different type of user and validate. 

Phase 7:
This phase allows the tutor to record session start and end real time. When the session is to start, the tutor could click the start session button and select student. The start time will be nearest 15 min, when the session ends, it will again record session end to nearest 15 min. The tutor can record session details at that time or can edit those later.

Phase 8:
This is dashboard phase. The goal of this phase is to provide a dashboard for individual user types. 
Admin will see cards for how many students are actively enrolled, how many parents, how many tutors etc. The admin should also see balances on each tutor, parent etc. The cards should be clickable to get more details. The admin should also see audit of last few entries throughout the system. 
A tutors dashboard will have student cards, applicable payment cards etc. A log of activity in reverse chronological order. Conducted sessions log in reverse chronological order etc.
Parent dashboard will have payment card, session log in reverse chonological order. 
Handle cases where a single user could have multiple roles and so dashboard should have ability to select the role for that user.

Admin will have ability see the dashboard as seen by inidvidual user. On the main dashboard, the admin should be able to see all users and can then select a user to see the dashboard as shown to that user.

This is the place for you to build industry standard intuitive and exciting dashboard with animation etc.

Phase 9: 
Ability to download a calendar file for scheduled tutoring sessions. A tutor should be able to schedule a recurring tutoring session for his/her students. And all applicable users (parents, tutors, admins, students) should be able to download the calendar invite for those session.

Phase 10: 
Ability to download csv for payments and tutoring session log. Allow applicable users to see a grid of session and/or payments and download that in csv format to open in excel sheet.

Phase 11:
This phase is about bringing up test environment. Create new database test instance, worker test instance and test portal. 
Playwright will no longer use the production instance and the test database will be seeded with a couple of admin accounts, 10 tutors, 30 parents and 50 students.
Run all playwright tests on this instance and verify. Disable authentication on the test portal

Phase 12: 
Allow ability to record a comment. The comment will include the timestamp, the user and target. The target could be a user, a scheduled session, an assignment of the tutor/student relationship or a session itself.
Comments are only shown to the related parties. Comments are not editable. They can only be deleted by the user who entered it.

Build a reverse chronological view which depicts applicable comments for any entity. 

Do a detailed industry standard best practice for this ask and come up with a plan to implement and execute.

Phase 13:
This phase is to build a feature which allows admin to record a topup amount per tutor. This is amount say 100$, that admin will set per tutor. The admin mostly pays the tutors in advance. If the total amount with the tutor (total paid - earned or owed amount) is less than the topup amount, then the admin will make another payment to the tutor to keep the balance above the topup amount. 

Build the data model to support it and also show this on the dashboards accordingly.

Phase 14:
This phase is about financial management. At the end of the year, the admin would have to generate tax documents for the tutor. We do not intend to record the SSN in this database. But I would like the database to be extended to confirm that admin has received the SSN from tutor. The field on tutors should indicate that. Other wise it should show up dashboard both for tutor and admin that tutor's SSN has not been shared and an action is needed. Ensure, no SSN is ever persisted in this database or portal.

Phase 15:
This phase is about cleaning the dashboard for admins and tutors. There are two major parts of this application. Finance and Tracking tutoring progress. I would like to evaluate creating these two tabs and see how we can made dashboard little more crisp and effective. Currently the cards are too big and waste a lot of white space.
In finance tab - I want a monthly run down of the current financial year, which will show how many sessions, how many hours, billed for that month, received in that month, Net in that month etc. I want to also have ability for admin to create 1099 year end for the tutor. This will open up a dialog to accept SSN on the UI. The SSN as agreed will not be persisted anywhere and 1099 will be created for that tutor. 
Other metrics will move into Tutoring progress tab and we will work on that in the next phase.

Phase 16: 
This math tutoring coursework is based on beast academy, level 1-5 and AOPS beyond level 5 - prealgebra, algebra and geometry. At the beginning of enrollment, the owner assesses the student based on what they are currently enrolled in and then recommends the level. Sometimes he will even recommned adding some topics from other levels - likely a lower one.
In this phase we will first start with addint the levels and topics from each level. Dig into Beast academy and AOPS and create a db model to store them and store them in the DB.
Then extend the sttudent data model to record the initial assessment. The intial assessment would be a long prose but I also want a way of recording say 1-5 levels against topics at a level. The assessor could pick say topic 10 from level 3 and mark as 1. Marking 1 on a topic means the studnet perform poorly or needs help. Recommend a good naming convention for levels.
Once the assessor records the assessment, then he will recommend the course of tutoring against the goal. For example - goal could be get ready for prealgebra by next academic year and then record what topics/levels need to be included, how often to schedule the sessions like twice a week 1 hour sessions. The data model clearly supports the goal. Now I want to extend the data model to retain the assessment, levels on each topic and tutoring session recommendation to achieve that goal.
When the tutor records the session, the tutor will record the assessment of the tutoring session against the recommended goal and track the progress.
The dashboard will include the timeline of the beginning of tutoring, the goal timeline and how each session is tracking towards the goal. Use some charting option to build a best and most intuitive UI.

Phase 17.
The amount recorded in the session should be curated based on the user. The parent/or student should see the amount they have to pay. The tutor should see the amount that is paid to the tutor. Admin should see the amount that parent/student is charged and also see the amount or cut for the institution.
Ensure the data model changes, if any are needed for this. Make the data/api/UI changes as needed and deploy them

Phase 18.
Do a detailed analysis of UI/api code and ensure the data that is shown to the logged in user (other than admin) is relevant and as expected so the issues like in Phase 17 do not slip through.

Phase 19:
I want to address another data visibility concern shared from the user feedback. In the sessions page, tutor is expected to use this during the tutoring session to refer to the previous session notes  and or notes for this session. Now it also shows money received by the tutor and paid by parents. The issue is one student can see get a view of the charges since tutor could be on that page infront of the student.  Just line dashboard for admin has finance and tutoring tab, create similar tabs in sessions page and on tutoring tab (selected by default) exclude all financial information

Phase 20: (planned -- do not build until asked)
Email session notes to the people who can already read them, and send calendar invites in addition to the calendar download.

Sending: use a transactional email provider (Resend or similar) called from the Worker over HTTPS, with its API key as a Worker secret. This keeps the portal on Cloudflare's free tier (Cloudflare's own Email Service needs Workers Paid and the domain's DNS moved to Cloudflare). The domain's DNS is at GoDaddy and its mail is Microsoft 365, so send from a subdomain such as notes@portal.trianglemathinstitute.com and add the provider's SPF/DKIM records for that subdomain only -- the root domain's SPF ("-all") and M365 records stay untouched. Replies go to the tutor or the office via Reply-To. Free tier is about 3,000 emails a month and 100 a day; check that against lessons per day.

Session notes by email:
- An "Email notes" button on a session for its tutor and admins, showing who will receive it before sending. Automatic sending when a lesson is recorded can come later as a setting.
- Recipients are the note's existing audience and no wider: the student's guardians, the student if they have an email, admins, and a copy to the tutor. Each person can opt out; the preference belongs to the person (users), not a profile.
- The email carries the date, length, notes and progress -- never an amount (the Phase 19 concern). The SSN guard on notes already applies.
- An audit event per send naming the recipients, never the note text. A small send log records delivered/failed so a failed send is visible and can be retried. Never log the body.

Calendar invites:
- When a schedule is created, email an invite to the tutor, the student and their guardians; when it is edited, an update; when it is removed, a cancellation.
- The .ics becomes an invitation (METHOD:REQUEST with ORGANIZER and ATTENDEE, METHOD:CANCEL on removal) with times in the institute's time zone (TZID plus VTIMEZONE) instead of floating times, keeping the existing stable UID. Store a per-schedule sequence number, bumped on every edit, so clients replace the event rather than duplicate it.
- Downloading the calendar file stays as it is.

Alternatives considered: Cloudflare Email Service (needs Workers Paid and a DNS move off GoDaddy), Gmail/Google Calendar APIs through an admin's one-time grant (sends from a personal Gmail, needs Google's sensitive-scope verification, and stops working if the token is revoked), and mailto / "Add to Google Calendar" links (no setup, but nothing is actually sent by the portal).

Phase 21: (built)
The dashboard still needs cleanup.
There is no point in showing admin card with number of admins.
Compress the card sized and align then completely. Create a section called analytics and add those cards. No need to mention "none in progress" in running sessions card. That messes up alignment.
Then section below that should Tutoring Sessions. Make this very aesthetic carousel. Combine the data from the schedules to create a card for upcming 5 sessions. There could be a right arrow indicator to pull the next 5 sessions. Combine the data from past 5 sessions and create cards on the left. The next upcming session card should have size and color indicator to highlight it as the most important.
The next section under should be "Progress".  This will show a random 5 user cards and will have "All Progress" that will take to the "Progress" to see progress of all students. That page will have filter for student or all students for a specific tutor etc. The card on the dashboard will have a compressed timeline graph that we show on the progresses page.
The lowest session will be the least important "Recent Activity". This will only show last 5 items in reverse chronological order


