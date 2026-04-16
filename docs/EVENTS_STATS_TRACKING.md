# 📘 Event Networking Platform – Project Specification

## 🧭 Purpose of This Document

This document defines:

* - the **core concepts**
* - the **data structures**
* - the **business rules**
* - the **feature expectations**

It is intended to allow **any contributor to continue the project without prior context**.

---

# 🧠 Product Vision

This platform enables **real-world networking during events**  by transforming interactions into structured data.

### Core idea:

* - People attend events
* - They **scan each other (QR code)**
* - This creates **connections**
* - These connections generate **insight for students, companies, and organizers**
* - Track events **stats**

---

# 👤 Core Entities

## 1. Profile

Represents a person or organization.

```ts
type Profile = {

  // main profile vars
  id: string,
  firstName?: string,
  lastName?: string,
  email: string,
  githubUsername?: string,
  devpostUsername?: string,
  createdAt: Timestamp,
  gpa?: double,
  grades: {
    id: string,
    name: string,
    type: string, 
    uploadAt: Timestamp,
    url: string
  },
  graduationYear?: string,
  initials?: string,
  intershipCompleted?: int,
  linkedinUrl?: string, 
  numberOfCredit?: string, 
  organization?: [{id: string}],
  phone?
  portfolioUrl?: string,
  program?: string,
  resume?:{
    id: string,
    name: string,
    type: "resume",
    uploadAt: Timestamp,
    url: string
  },
  school?: string,
  schoolEmail?: string,
  skills?: [{value: string}],
  university?: [{id: string}] 
  userId?: string

  events: [{
    eventId: string, 
    participantId: string
  }]

  qrCode?: [{
    url: string,
    eventId: string,
    counter: string
  }],

}
```

> [!NOTE]
> * - Every user MUST have a profile
> * - QR codes are tied to profiles
> * -  Profile is used during scan interactions

---

## 2. Event

Represents a single event.

```ts
type Event = {
    Tech:string,
    city?: string,
    communityId: string,
    createdAt: timestamp,
    createdBy: string,
    description?: string,
    endDate: string,
    endTime: string,   
    heroImage?: string,
    hostType: string,
    isPaid: boolean,
    location?: string,
    mode: string,
    registrationLink: string,
    slug: string,
    startDate: string,
    startTime: string,
    status: string,
    title: string,
    updatedAt: string,
    winners?: [{id: string}],
    organizer: [{id: string}], 
    stand?: [{id: String}] // TBD 
    participants: [id: String]
    schedule: Image/String
    participants: [{Participant}]
    helpSearch: [{
        status: bool
        Value: String
    }]
}
```

---

## 3. Event Participation

Represents the relationship between a profile and an event.

```ts
type Participant = {
  
  id: string,
  eventId: string,
  profileId: string,
  // role inside event
  role: "attendee" | "organizer" | "company" | "volunteer" | "sponsor" | "judge" | "mentor",
  // request lifecycle
  status: "pending" | "approved" | "rejected" | "waitlist",
  createdAt: Timestamp
}
```

> [!IMPORTANT]
> ### Rules
> * - A profile can only have **one participation per event**
> * - Participation must go through **status transitions**
> * - Organizers can **approve/reject requests**
> * - Event can also auto approve requests. If max attendee is reach request status will be **waitlist**
> * - Auto-approved system is allowed

---

## 4. Connection (CORE FEATURE)

Represents a real-world interaction between two profiles.

```ts
type Connection = {
  id: string

  eventId: string

  fromProfileId: string
  toProfileId?: string
  toEmail?: string

  // who initiated scan
  scannedBy: "participant" | "sponsor" | "organizer" | "judge" | "mentor" | "volunteer" | "anonymous"
  createdAt: Timestamp

  // denormalized fields (for fast reads)
  fromName: string
  toName: string
}
```

---

# 🔗 Connection Logic

## QR Scan Flow

1. User A displays QR code
2. User B scans QR code
3. System resolves QR → Profile A
4. System prompt user:
    - Option 1: Sign In
    - Option 2: Sign Up
    - Option 3: Share Email with Tailed 
    - Option 4: Stay Anonymous

```ts
createConnection({
  eventId,
  fromProfileId: string,
  toProfileRef?: string, //Id or Email? 
})
```

---

## Rules

* - A connection MUST belong to an event
* - A user cannot connect to themselves
* - Duplicate connections SHOULD be prevented or flagged
* - Connections are immutable once created

---

# 🧩 Event Features

## Company Perspective

Companies attending events should be able to:
* - find new events
* - notifications when followed community event is plan
* - Track:
  * - number of connections per employee
  * - number of connections per event
  * - number of connections per stand 
  * - number of anonymous connections
  * - total participants
  * - winners
* - View:
  * - best student match with company open position
  * - most engaged students
  * - quick student profile preview after scan

## Data to store

* - eventId
* - standId
* - connectionId
* - profileRef (if not anonymous)
* - connectedAt (timestamp)


> [!INFO]
> * - Add the connection id in the student and employee profile
> * - ProfileRef = email || profileId

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

# 🧠 Role System

Roles are assigned per event:
* - organizer
* - Participant: 
    * - attendee
    * - volunteer
    * - sponsor
    * - judge
    * - mentor

> [!NOTE]
> * - Roles are flexible and extensible
> * - Profile can have multiple role in a single Event
> * - The organizer can't be part of the participants roles

---

# 📅 Schedule System (Planned)

```ts
type EventScheduleItem = {
  id: string
  eventId: string

  title: string
  description?: string

  startTime: Timestamp
  endTime: Timestamp
}
```

---

# 🧑‍🤝‍🧑 Community Logic

Events may belong to a community.

```ts
type Community = {}
```

---

# 📊 Metrics & Tracking (Conceptual)

The system should support:

* - total participants per event
* - total connections per event
* - connections per company
* - connections per student

⚠️ These metrics are expected to be **precomputed**, not calculated on demand.

---

# 🔔 Notifications (Planned)

Events that should trigger notifications:

* - New connection created
* - Participation approved/rejected
* - Event starting soon
* - Follow community upcomming event

---

# 🔌 Integrations (Open Questions)

* - Google Calendar sync for events
* - Organization / team management

---

# ⚠️ Constraints & Assumptions

* - System is designed for **real-time event usage**
* - Data integrity must be maintained during high activity (many scans)
* - Connections are the **most critical data point**

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

# 🧠 Final Insight

This system is not just about events.

It builds a:

> **real-world interaction graph**

If extended properly, it can evolve into:

* - recruitment intelligence platform
* - networking analytics system
* - professional discovery engine

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

---

