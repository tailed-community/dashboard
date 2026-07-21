import { describe, expect, it } from "vitest";
import { parseResumeText } from "../resume-parser";

describe("parseResumeText", () => {
  it("parses a title-first resume ('Title, Org' order)", () => {
    const text = `
Jordan Smith
jordan@example.com

EXPERIENCE
Software Engineer, Acme Technologies Inc.
June 2022 - Present
- Built internal tooling used by 40 engineers
- Reduced build time by 30%

EDUCATION
University of Toronto
Bachelor of Science in Computer Science
2022
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(1);
    expect(experiences[0].title).toBe("Software Engineer");
    expect(experiences[0].organization).toBe("Acme Technologies Inc.");
    expect(experiences[0].startDate).toBe("2022-06");
    expect(experiences[0].current).toBe(true);
    expect(experiences[0].endDate).toBeNull();
    expect(experiences[0].source).toBe("resume-parse");
  });

  it("parses a company-first resume without swapping title/org", () => {
    const text = `
EXPERIENCE
ACME TECHNOLOGIES INC.
Software Engineer
Jan 2021 - Dec 2022
- Shipped features end to end

Beta Robotics Corp.
Marketing Coordinator
2019 - 2020
- Ran the summer campaign
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(2);

    const first = experiences[0];
    expect(first.title).toBe("Software Engineer");
    expect(first.organization).toBe("ACME TECHNOLOGIES INC.");

    const second = experiences[1];
    expect(second.title).toBe("Marketing Coordinator");
    expect(second.organization).toBe("Beta Robotics Corp.");
  });

  it("strips a location from the header instead of corrupting title/org", () => {
    const text = `
EXPERIENCE
Product Designer, Bright Studio Inc., Toronto, ON
March 2020 - August 2021
- Led design for the mobile app
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(1);
    expect(experiences[0].title).toBe("Product Designer");
    expect(experiences[0].organization).toBe("Bright Studio Inc.");
    expect(experiences[0].location).toBe("Toronto, ON");
  });

  it("parses a French resume with French date connectors and section headings", () => {
    const text = `
EXPÉRIENCE PROFESSIONNELLE
Développeuse logicielle, Solutions Numériques Inc.
de janvier 2022 à présent
- A conçu des applications web

FORMATION
Université de Montréal
Baccalauréat en informatique
2021
`;
    const { experiences, education } = parseResumeText(text);
    expect(experiences).toHaveLength(1);
    expect(experiences[0].title).toBe("Développeuse logicielle");
    expect(experiences[0].organization).toBe("Solutions Numériques Inc.");
    expect(experiences[0].current).toBe(true);
    expect(experiences[0].startDate).toBe("2022-01");

    expect(education).toHaveLength(1);
    expect(education[0].school).toContain("Université de Montréal");
    expect(education[0].program).toContain("Baccalauréat");
    expect(education[0].graduationYear).toBe("2021");
  });

  it("emits entries for season and single-year dates instead of dropping them", () => {
    const text = `
EXPERIENCE
Marketing Intern, Northwind Co.
Summer 2023
- Assisted with campaign launches

Research Assistant, State University Lab
2021
- Collected and analyzed survey data
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(2);

    const seasonEntry = experiences.find((e: any) => e.organization === "Northwind Co.");
    expect(seasonEntry).toBeTruthy();
    expect(seasonEntry.title).toBe("Marketing Intern");
    expect(seasonEntry.employmentType).toBe("internship");
    // No exact month is derivable from a season, so startDate/endDate stay
    // unset, but the raw date text is preserved in the description.
    expect(seasonEntry.startDate).toBeUndefined();
    expect(seasonEntry.description).toContain("Summer 2023");

    const yearEntry = experiences.find((e: any) => e.organization === "State University Lab");
    expect(yearEntry).toBeTruthy();
    expect(yearEntry.title).toBe("Research Assistant");
  });

  it("recognizes an unknown/synonym section heading ('Career History')", () => {
    const text = `
CAREER HISTORY
Business Analyst, Contoso Ltd.
2020 - 2022
- Modeled quarterly forecasts
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(1);
    expect(experiences[0].title).toBe("Business Analyst");
    expect(experiences[0].organization).toBe("Contoso Ltd.");
  });

  it("categorizes skills into language/framework/tool/soft buckets", () => {
    const text = `
SKILLS
Languages: Python, JavaScript, SQL
Frameworks: React, Django
Tools: Docker, Git, Figma
Soft Skills: Leadership, Communication
`;
    const { skills } = parseResumeText(text);
    const byName = (name: string) => skills.find((s: any) => s.name.toLowerCase() === name.toLowerCase());

    expect(byName("Python").category).toBe("language");
    expect(byName("JavaScript").category).toBe("language");
    expect(byName("React").category).toBe("framework");
    expect(byName("Django").category).toBe("framework");
    expect(byName("Docker").category).toBe("tool");
    expect(byName("Git").category).toBe("tool");
    expect(byName("Leadership").category).toBe("soft");
    expect(byName("Communication").category).toBe("soft");
    // `level` must never be guessed.
    for (const skill of skills) {
      expect(skill.level).toBeUndefined();
    }
  });

  it("infers employmentType from title/description keywords without ever defaulting to full-time", () => {
    const text = `
EXPERIENCE
Software Engineering Intern, Acme Inc.
Summer 2022
- Built features

Volunteer Coordinator, Local Food Bank
2021 - 2022
- Organized weekly drives

Co-op Student, Big Corp
Jan 2023 - Apr 2023
- Worked on the platform team

Product Manager, Steady Co.
2019 - 2020
- Owned the roadmap
`;
    const { experiences } = parseResumeText(text);
    const byOrg = (org: string) => experiences.find((e: any) => e.organization.includes(org));

    expect(byOrg("Acme").employmentType).toBe("internship");
    expect(byOrg("Food Bank").employmentType).toBe("volunteer");
    expect(byOrg("Big Corp").employmentType).toBe("co-op");
    // No explicit "full-time"/"part-time" signal — must stay undefined, not default.
    expect(byOrg("Steady Co.").employmentType).toBeUndefined();
  });

  it("accepts an education block with only a school signal (no degree keyword)", () => {
    const text = `
EDUCATION
Humber College
Data Analytics
2023
`;
    const { education } = parseResumeText(text);
    expect(education).toHaveLength(1);
    expect(education[0].school).toBe("Humber College");
    expect(education[0].program).toBe("Data Analytics");
    expect(education[0].graduationYear).toBe("2023");
  });

  it("accepts an education block with only a degree signal (no school keyword)", () => {
    const text = `
EDUCATION
Bachelor of Arts in Psychology
Springfield Campus
2020
`;
    const { education } = parseResumeText(text);
    expect(education).toHaveLength(1);
    expect(education[0].program).toContain("Bachelor of Arts");
    expect(education[0].fieldOfStudy).toBe("Psychology");
  });

  it("never throws on empty or garbage input and always returns the full shape", () => {
    for (const input of ["", "   ", "asdkjh asd \n\n\n ---- \t\t", "🎉🎉🎉\n\n"]) {
      const result = parseResumeText(input);
      expect(result).toEqual({
        experiences: [],
        education: [],
        projects: [],
        skills: [],
      });
    }
  });

  it("does not let a comma-separated location in the header get treated as an org", () => {
    const text = `
EXPERIENCE
Sales Associate
Toronto, ON
Retailer Group Inc.
May 2018 - Sep 2019
- Handled customer inquiries
`;
    const { experiences } = parseResumeText(text);
    expect(experiences).toHaveLength(1);
    expect(experiences[0].title).toBe("Sales Associate");
    expect(experiences[0].organization).toBe("Retailer Group Inc.");
    expect(experiences[0].location).toBe("Toronto, ON");
  });
});
