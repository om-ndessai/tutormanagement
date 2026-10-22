This is about introducing sticky behavior on the platform (specifically app).
I want these to be next phases of implementation.
The goal is to identify gamification opportunities.

Phase G1
The first gamification I want to introduce is around approving the questions of the question bank.
Add a set of flags for gamification at the organization level.
First flag would be question approval.
For an organization with this flag set, each student can be assigned a beginning grade.
When that student logs into the platform, the student land into assessemnt workflow with the next un approved question from the question bank beginning with the beginning grade assigned to the student.
The student can then submit answer of each question sepearately. There is no going back to any question. 
When a tutor logs into the organization, the tutor will be presented with the assessment review workflow, with the next question submitted by the student that has not been approved yet.
Once the tutor reviews the answer, if the tutor marks the answer as correct, the question is recorded as approved and a point is awarded to both tutor and student.
Create required data model to retain the points for tutors and/or students.
Retain other metrics such as streak, number of consecutive days etc.
Create proposals for awarding or redeeming the points and or badges to improve gamification.
Build multiphase plan to implement this if required.
I would want to launch this automated workflows fullscreen especially on the app or ipads.


Phase G2
This phase is about improving the gaming experience in Quest. Add Beta flag to Quest menu

On Start game page make following changes
1. Change the single page flow into wizard flow
2. Instead of drop down use tiles format. This selection should be the first step in the wizard. In addition to well defined grade tiles, allow another Random selection - this will be accompanied by a drop down to select the starting grade. In Random selection, random questions will be selected from question bank but no lower than the selected starting grade.
3. Page two will specify if the game is time bound or limited by number of questions.
4. Third page will be scoring mechanism. Instead of preselected scoring buttongs, allow user to specify score for right question and separately for wrong question. Use number counter input with +/-. Add a checkbox for Knockout - this will end the game in midplay if the remaining teams have no chance of winning. (this is defined in # 11 below.)
5. Next page will Single player or multiplayer. For single player, the individual user can just start for self improvement. For multiplayer, the user can specify - Max number of teams. Whether each team consists of single player or can multiple other users join the team. Game initiator can also specify higher limit for each team size. If team size is capped at 2 users than third user will not be allowed to join that team. On this page the initiator can also specify if the users can join the game after it started or joining the game is closed after starting it.
6. The next page lets the user review the information, save it as a favorite (allow users to set their favorites quest configurations.). So on the first page if user has favorites then those also need to be listed. Let the user name the favorites configuration.
7. The action item on page 6 will be called "Generate Game code" if its a multiplayer setup. The initiator cannot go back in the flow after clicking this. If its a single player, then CTA will be "Start Game".
8. After generate code - The backend will generate a code that can be shared and is open for other players/teams to join. In games where multiple people can join the team, each user will first have to enter the game code to join. Once they join, they will have their own team code generated. They can then share the code for other members to join their team. So, other members will have to enter two codes - one for the game and one for the team.
9. All users after entering the codes will be on game status page where it shows the people/teams and their statuses. The CTA on that screen is "Start the Quest". Once it is started, everyones status screen will do a count down animation (create some exciting gif about door opening or something) and the game will start.
10. After any player is done with answering the questions or running into time limit, the users will land on game status screen where the statuses/scores of other participants will be shown.
11. The game can also end at this point, If the format is knockout - and if the remaining teams have no path to winning or beating other remaining teams. Eg - in a two team setup, if one team finished with score say 20/25 and the other remainign team is at question #6 but with 0 score, it still may not be able to get 20 so the game can end. Show a knockout animation on the game status page. Show confetti on winners status page and positive envouragement on others.

Phase G3:
This phase is about curating the questions for the quest. The questions for the quest from the question bank should be built after the initiator starts the game after waiting in the lobby for other users to join. The main idea is to curate the list so that the users dont end up with same questions over and over again.
As the users are presented the question, record an entry in the database about linking the users and the question that the users have seen. The question list generation service should then use this as a filter to ensure that question list excludes any question have been shown to any of the users in the game. If the question bank does not have any more questions, the service can then go up levels in the grade and pull them till the question list requirement is satisfied.