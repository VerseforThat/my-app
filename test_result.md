#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Bible-verse companion app "Verse for That". Latest user requests:
  1) Move clickable problem topics (chips) to BELOW the text input so user sees the box first.
  2) Helper line should read: "Tap one of the options below or describe it in your own words."
  3) Daily verse notification: enable scheduling at 8 AM (morning default).
  4) Polish the "Read more context" button (already wired to /api/verses/{id}/context).

frontend:
  - task: "Reorder home: text box first, chips below with new helper copy"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Moved TextInput + Find-my-verse button above chips. Helper text now: 'Tap one of the options below or describe it in your own words.' Verified visually via screenshot — layout renders correctly on 390x844 mobile viewport."

  - task: "Daily verse notification at 8 AM with persisted toggle"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/settings.tsx, frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added Notifications.setNotificationHandler in _layout.tsx for foreground alerts. settings.tsx now restores toggle state from storage on mount, persists ON/OFF, schedules a DAILY trigger (hour=8, minute=0) via SchedulableTriggerInputTypes.DAILY, and gracefully handles web (where local notifications aren't reliable). Cancels prior notifications to prevent duplicates."

  - task: "'Read more context' premium UI"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Already implemented in earlier session: BookOpen-iconed pill button below verse, opens pageSheet modal, fetches /api/verses/{id}/context, gates non-premium users to paywall with PREMIUM lock tag. Backend confirmed in logs (200 OK for context endpoint)."

backend:
  - task: "/api/verses/{id}/context endpoint (premium-gated)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Endpoint already verified working from previous iteration logs (200 OK for premium, 402 for free)."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 6
  run_ui: false

test_plan:
  current_focus:
    - "Reorder home: text box first, chips below with new helper copy"
    - "Daily verse notification at 8 AM with persisted toggle"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Three small UX changes: (1) Home screen now shows the text box and 'Find my verse' button before the suggestion chips, with refreshed helper text. (2) Daily verse reminder is fully wired: foreground notification handler in _layout, persistent toggle in Settings using existing storage shim, DAILY trigger at 8 AM. (3) Read more context UI confirmed working from prior testing. No backend changes — only frontend. Web preview verified visually."
