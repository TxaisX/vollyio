import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SKILLS } from "@/lib/skills";
import { DRILLS } from "@/content/drills";
import { REHAB } from "@/content/rehab";

// The technique and drill pages are the only surfaces on this site a stranger
// can find by searching for their actual problem, and they were the only ones
// missing from here. They are generated from SKILLS and DRILLS rather than
// listed by hand, so a new skill or drill is discoverable the day it ships
// instead of the day someone remembers this file.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/samples`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/learn`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/drills`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/start`, changeFrequency: "yearly", priority: 0.9 },
    { url: `${SITE_URL}/signup`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  for (const skill of SKILLS) {
    entries.push({
      url: `${SITE_URL}/learn/${skill}`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const drill of DRILLS) {
    entries.push({
      url: `${SITE_URL}/drills/${drill.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // The injury library, generated from the same authored source the seed reads,
  // so a new entry is discoverable the day it ships. These are the pages most
  // likely to be found by someone searching their actual problem at 11pm:
  // "jumper's knee" and "rolled ankle volleyball" are things people search in a
  // way that "setting drills" is not.
  for (const entry of REHAB) {
    entries.push({
      url: `${SITE_URL}/learn/rehab/${entry.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
