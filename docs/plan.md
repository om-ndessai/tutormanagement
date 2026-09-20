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

