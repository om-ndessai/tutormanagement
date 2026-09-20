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
Portal enhancement for Tutors. This phase will make enhancements for tutors. Only admins can add another user. A parent must be created before a student can be created. And admin can assign student to tutors.

A tutor will have a default hourly rate. The rate can be different for in person vs virtual. The system should also allow variable rate for each student/tutor relation. Admin, when assigning a student to the tutor can specify the hourly rate.

After each session, the tutor will record that session was held. Will specify the start / end time. Come up with intuitive way of recording start/end time and calculate the session time by rounding to 15 min interval. Eg- session times will be like 1hr, 1hr 15 mins, 1hr 30 mins and so on. The tutor will also need ability to enter notes of the session - could include feedback, track towards the goal, session assessment, home work etc. 

After the session details are saved, the amount for the session will be calculated and saved. This will drive the billables for the session and will help the admin to keep track of amount the tutor has earned.

Phase 4: 
Payment enhancements. No actual payments will be made through the portal. Its only to keep track of what a tutor owns and let admin record when the payment was received from the parent and when the payment was made tot he tutor. The payments should allow recording date time, amount, for which student if the payment is coming from parent etc. Balances need to be supported for parents as well as tutors. The payment form need to be supported are venmo, zelle, cash, check. 

Phase 5:
This phase is about thourough end-to-end testing. For each testing session, wipe out the database and rebuild through automation testing. Iterate through to make changes to the data model, api, ui etc till the goals described in above phases are achieved.
I want to use playwright for testing. Use the production site/url, DB for testing. Disable authentication during the testing. 
The goal for this phase is to confirm end-to-end workflows for different types of users. Launch portal as a different type of user and validate. 

