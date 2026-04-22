# 📘 Event & 🔗 Connection

**This documentation will streamline the process of the participation, creation and management of events**

---
## Events
* - A Community profile will be able to request to add an event to tail'ed 
* - An admin will create the event a link it to the organization, an email will be sent to claim to event management on the platform
* - A community profile will be able to request to participate to an event on the platform
    * - Inscription Form will autocompleted when possible
        * - Sub objectif: Get the inscription without forms
* - The event community manager will be able to customize the event (Banner, logo, descriptions and more)
* - The event community manager will be able to find and request for help (judges, volunteers, mentors, sponsors)
    * - Track previous helper on events and trigger invites to help upgoing events

> [!IMPORTANT]
> ### Rules
> * - A profile can only have **one participation per event**
> * - Participation must go through **status transitions**
> * - Organizers can **approve/reject requests**
> * - Event can also auto approve requests. If max attendee is reach request status will be **waitlist**
> * - Auto-approved system is allowed

---

# 🧾 Participation Flow 1

```text
User requests to join event
        ↓
Status = pending
        ↓
Organizer reviews
        ↓
approved | rejected | waitlist
```

# 🧾 Participation Flow 2

```text
User requests to join event
        ↓
Status = approved | wailist
```

---

## 🔗 Connections

- Connections are stored in community database
- Platform will fetch data from community to gater info
- Qr Code created from the community side will be store in community
- Qr Code created from the platform site will be store in platform + the stats gatering
- Profiles Settings will let the user choose what to display on is public profile 
- Community Profile will be unique

### QR Scan Flow

1. User A displays QR code
2. User B scans QR code
3. System resolves QR → Profile A
4. System prompt user:
    - Option 1: Sign In
    - Option 2: Sign Up
    - Option 3: Share Email with Tailed 
    - Option 4: Stay Anonymous

---

## Student Perspective

Students should be able to:

* - Track connections made
* - Collect event win trophies
* - Collect event participation trophies

---

## Organizer Perspective

Organizers manage:

* - Event creation
* - Participant requests
* - Team management
* - Role assignments:
  * - Participants
  * - Volunteers
  * - Sponsors
  * - Judges
  * - Mentors
* - Participant management 
  * - Participant 
  * - Judges 
  * - Mentors 
  * - Sponsors 
  * - Volunteers
* - Compile votes
* - Establish winners

> [!NOTE]
> The uses cases for the Organizer Perspective need to be determined
> Please ensure to documents the uses cases clearly

---

# 🧭 Development Guidelines

## DO

* - Keep entities **simple and focused**
* - Treat **connections as the core feature**
* - Always attach data to an **event context**

## DO NOT

* - Mix unrelated responsibilities into one entity
* - Add features without defining:
  * - data model
  * - rules
  * - lifecycle

---

# 🧩 Contributor Notes

If you are continuing this project:

1. Start from:

   * - Profile
   * - Event
   * - Participation
   * - Connection

2. Validate all new features against:

   * - event context
   * - connection system

3. When adding a feature:

   * - define entity
   * - define rules
   * - define lifecycle


> [!NOTE]
> All break changing pull request will be denied. We suggest not changing the implementation, but how the experience of tail'ed community.
> If you want to create a major pull request document the feature and ask an approval to an official tail'ed partner

---