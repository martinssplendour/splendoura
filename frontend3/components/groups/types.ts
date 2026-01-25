export interface GroupRequirement {
  applies_to: string;
  min_age: number;
  max_age: number;
}

export interface SwipeGroup {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  activity_type: string;
  category?: "mutual_benefits" | "friendship" | "dating" | null;
  location?: string | null;
  start_date?: string | null;
  cost_type: "free" | "shared" | "fully_paid" | "custom";
  max_participants: number;
  min_participants: number;
  approved_members?: number | null;
  cover_image_url?: string | null;
  shared_tags?: string[] | null;
  tags?: string[] | null;
  offerings?: string[] | null;
  expectations?: string | string[] | null;
  requirements?: GroupRequirement[] | null;
}
