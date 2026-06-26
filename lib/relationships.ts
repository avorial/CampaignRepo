export type RelationshipType = {
  type: string;
  label: string;
  inverse: string;
  inverseLabel: string;
  category: string;
};

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  // Faction / social
  { type: "member-of",       label: "Member of",      inverse: "has-member",      inverseLabel: "Has member",      category: "faction"   },
  { type: "leads",           label: "Leads",           inverse: "led-by",          inverseLabel: "Led by",          category: "faction"   },
  { type: "serves",          label: "Serves",          inverse: "is-served-by",    inverseLabel: "Is served by",    category: "social"    },
  { type: "allied-with",     label: "Allied with",     inverse: "allied-with",     inverseLabel: "Allied with",     category: "faction"   },
  { type: "enemy-of",        label: "Enemy of",        inverse: "enemy-of",        inverseLabel: "Enemy of",        category: "conflict"  },
  { type: "rival-of",        label: "Rival of",        inverse: "rival-of",        inverseLabel: "Rival of",        category: "conflict"  },
  { type: "knows",           label: "Knows",           inverse: "known-by",        inverseLabel: "Known by",        category: "social"    },
  // Location
  { type: "located-in",      label: "Located in",      inverse: "contains",        inverseLabel: "Contains",        category: "location"  },
  { type: "originated-from", label: "Originated from", inverse: "origin-of",       inverseLabel: "Origin of",       category: "location"  },
  // Family
  { type: "parent-of",       label: "Parent of",       inverse: "child-of",        inverseLabel: "Child of",        category: "family"    },
  { type: "spouse-of",       label: "Spouse of",       inverse: "spouse-of",       inverseLabel: "Spouse of",       category: "family"    },
  { type: "sibling-of",      label: "Sibling of",      inverse: "sibling-of",      inverseLabel: "Sibling of",      category: "family"    },
  { type: "guardian-of",     label: "Guardian of",     inverse: "ward-of",         inverseLabel: "Ward of",         category: "family"    },
  // Ownership / creation / political
  { type: "owns",            label: "Owns",            inverse: "owned-by",        inverseLabel: "Owned by",        category: "ownership" },
  { type: "created",         label: "Created",         inverse: "created-by",      inverseLabel: "Created by",      category: "ownership" },
  { type: "rules",           label: "Rules",           inverse: "ruled-by",        inverseLabel: "Ruled by",        category: "political" },
  { type: "founded",         label: "Founded",         inverse: "founded-by",      inverseLabel: "Founded by",      category: "political" },
  { type: "worships",        label: "Worships",        inverse: "worshipped-by",   inverseLabel: "Worshipped by",   category: "religion"  },
  // Session
  { type: "appears-in",      label: "Appears in",      inverse: "features",        inverseLabel: "Features",        category: "session"   },
  // Generic
  { type: "related-to",      label: "Related to",      inverse: "related-to",      inverseLabel: "Related to",      category: "generic"   },
];

export const REL_TYPE_MAP = new Map<string, RelationshipType>(
  RELATIONSHIP_TYPES.map(rt => [rt.type, rt])
);

export function getRelLabel(type: string): string {
  return REL_TYPE_MAP.get(type)?.label ?? type;
}

export function getInverseLabel(type: string): string {
  return REL_TYPE_MAP.get(type)?.inverseLabel ?? type;
}
