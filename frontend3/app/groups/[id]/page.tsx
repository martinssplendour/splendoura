"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import JoinRequestButton, { GroupRequirement } from "@/components/groups/join-request-button";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface GroupDetail {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  activity_type: string;
  category?: "mutual_benefits" | "friendship" | "dating" | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cost_type: "free" | "shared" | "fully_paid" | "custom";
  max_participants: number;
  min_participants: number;
  tags?: string[] | null;
  creator_intro?: string | null;
  creator_intro_video_url?: string | null;
  lock_male?: boolean | null;
  lock_female?: boolean | null;
  approved_members?: number | null;
  cover_image_url?: string | null;
  requirements: GroupRequirement[];
}

interface MemberItem {
  id: number;
  user_id: number;
  join_status: "requested" | "approved" | "rejected";
  role: "creator" | "member";
}

interface GroupMedia {
  id: number;
  url: string;
  media_type: "image" | "video";
  is_cover: boolean;
}

interface GroupAvailability {
  id: number;
  day_of_week: number;
  slot: string;
}

interface GroupPlan {
  id: number;
  title: string;
  details?: string | null;
  scheduled_at?: string | null;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  pinned: boolean;
}

interface GroupPollOption {
  id: number;
  label: string;
  vote_count?: number | null;
}

interface GroupPoll {
  id: number;
  question: string;
  is_multi: boolean;
  closes_at?: string | null;
  is_active: boolean;
  options: GroupPollOption[];
}

interface GroupPin {
  id: number;
  title: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface CreatorProfile {
  id: number;
  full_name: string;
  username?: string | null;
  profile_image_url?: string | null;
  profile_video_url?: string | null;
  badges?: string[] | null;
  reputation_score?: number | null;
  safety_score?: number | null;
  verification_status?: string | null;
  interests?: string[] | null;
}

interface GroupMemberProfile {
  id: number;
  full_name: string;
  username?: string | null;
  profile_image_url?: string | null;
}

const API_HOST =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SLOTS = ["morning", "afternoon", "evening", "night"];

export default function GroupDetailPage() {
  const params = useParams();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [mediaItems, setMediaItems] = useState<GroupMedia[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [availability, setAvailability] = useState<GroupAvailability[]>([]);
  const [plans, setPlans] = useState<GroupPlan[]>([]);
  const [polls, setPolls] = useState<GroupPoll[]>([]);
  const [pins, setPins] = useState<GroupPin[]>([]);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [approvedProfiles, setApprovedProfiles] = useState<GroupMemberProfile[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planDetails, setPlanDetails] = useState("");
  const [planScheduledAt, setPlanScheduledAt] = useState("");
  const [planLocation, setPlanLocation] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Option 1, Option 2");
  const [pollIsMulti, setPollIsMulti] = useState(false);
  const [pollSelections, setPollSelections] = useState<Record<number, Set<number>>>({});
  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");
  const [availabilitySelection, setAvailabilitySelection] = useState<Set<string>>(new Set());
  const [lockStatus, setLockStatus] = useState<string | null>(null);
  const [lockUpdating, setLockUpdating] = useState(false);
  const { accessToken, user } = useAuth();

  const pinnedPlan = useMemo(() => plans.find((plan) => plan.pinned), [plans]);

  const loadMembers = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/members`, { token: accessToken });
    if (res.ok) {
      const data: MemberItem[] = await res.json();
      setMembers(data);
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    async function loadGroup() {
      setLoading(true);
      const res = await apiFetch(`/groups/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
      setLoading(false);
    }
    loadGroup();
  }, [params.id]);

  useEffect(() => {
    if (accessToken && user?.id === group?.creator_id) {
      loadMembers();
    }
  }, [accessToken, group?.creator_id, loadMembers, user?.id]);

  useEffect(() => {
    async function loadExtras() {
      if (!accessToken) return;
      const [mediaRes, availabilityRes, plansRes, pollsRes, pinsRes] = await Promise.all([
        apiFetch(`/groups/${params.id}/media`, { token: accessToken }),
        apiFetch(`/groups/${params.id}/availability`, { token: accessToken }),
        apiFetch(`/groups/${params.id}/plans`, { token: accessToken }),
        apiFetch(`/groups/${params.id}/polls`, { token: accessToken }),
        apiFetch(`/groups/${params.id}/pins`, { token: accessToken }),
      ]);

      if (mediaRes.ok) {
        setMediaItems(await mediaRes.json());
      }
      if (availabilityRes.ok) {
        const data: GroupAvailability[] = await availabilityRes.json();
        setAvailability(data);
        const selections = new Set<string>();
        data.forEach((slot) => selections.add(`${slot.day_of_week}-${slot.slot}`));
        setAvailabilitySelection(selections);
      }
      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }
      if (pollsRes.ok) {
        setPolls(await pollsRes.json());
      }
      if (pinsRes.ok) {
        setPins(await pinsRes.json());
      }
      const membersRes = await apiFetch(`/groups/${params.id}/approved-members`, { token: accessToken });
      if (membersRes.ok) {
        setApprovedProfiles(await membersRes.json());
      }
    }

    async function loadCreator() {
      if (!accessToken || !group) return;
      const res = await apiFetch(`/users/${group.creator_id}`, { token: accessToken });
      if (res.ok) {
        setCreator(await res.json());
      }
    }

    loadExtras();
    loadCreator();
  }, [accessToken, group, params.id]);

  const handleLeave = async () => {
    if (!accessToken) return;
    await apiFetch(`/groups/${params.id}/leave`, { method: "POST", token: accessToken });
  };

  const handleRemove = async (userId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/remove/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
    }
  };

  const handleToggleSlot = (dayIndex: number, slot: string) => {
    const key = `${dayIndex}-${slot}`;
    setAvailabilitySelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveAvailability = async () => {
    if (!accessToken) return;
    const payload = Array.from(availabilitySelection).map((entry) => {
      const [day, slot] = entry.split("-");
      return { day_of_week: Number(day), slot };
    });
    const res = await apiFetch(`/groups/${params.id}/availability`, {
      method: "POST",
      token: accessToken,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setAvailability(await res.json());
    }
  };

  const handleCreatePlan = async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/plans`, {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({
        title: planTitle,
        details: planDetails || undefined,
        scheduled_at: planScheduledAt || undefined,
        location_name: planLocation || undefined,
        pinned: false,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setPlans((prev) => [created, ...prev]);
      setPlanTitle("");
      setPlanDetails("");
      setPlanScheduledAt("");
      setPlanLocation("");
    }
  };

  const handlePinPlan = async (planId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/plans/${planId}/pin`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      const updated = await res.json();
      setPlans((prev) => prev.map((plan) => ({ ...plan, pinned: plan.id === updated.id })));
    }
  };

  const handleCreatePoll = async () => {
    if (!accessToken) return;
    const options = pollOptions
      .split(",")
      .map((opt) => opt.trim())
      .filter(Boolean);
    const res = await apiFetch(`/groups/${params.id}/polls`, {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({
        question: pollQuestion,
        is_multi: pollIsMulti,
        options,
      }),
    });
    if (res.ok) {
      const poll = await res.json();
      setPollQuestion("");
      setPollOptions("Option 1, Option 2");
      setPollIsMulti(false);
      setPolls((prev) => [poll, ...prev]);
    }
  };

  const handleVotePoll = async (pollId: number, optionIds: number[]) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/polls/${pollId}/vote`, {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({ option_ids: optionIds }),
    });
    if (res.ok) {
      const pollsRes = await apiFetch(`/groups/${params.id}/polls`, { token: accessToken });
      if (pollsRes.ok) {
        setPolls(await pollsRes.json());
      }
    }
  };

  const togglePollSelection = (pollId: number, optionId: number) => {
    setPollSelections((prev) => {
      const next = { ...prev };
      const current = new Set(next[pollId] || []);
      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      next[pollId] = current;
      return next;
    });
  };

  const handleCreatePin = async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/pins`, {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({
        title: pinTitle,
        description: pinDescription || undefined,
        lat: pinLat ? Number(pinLat) : undefined,
        lng: pinLng ? Number(pinLng) : undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setPins((prev) => [created, ...prev]);
      setPinTitle("");
      setPinDescription("");
      setPinLat("");
      setPinLng("");
    }
  };

  const handleUploadMedia = async () => {
    if (!accessToken || mediaFiles.length === 0) return;
    for (const file of mediaFiles) {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch(`/groups/${params.id}/media`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
    }
    setMediaFiles([]);
    const res = await apiFetch(`/groups/${params.id}/media`, { token: accessToken });
    if (res.ok) {
      setMediaItems(await res.json());
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!accessToken || !group) return;
    const res = await apiFetch(`/groups/${group.id}/media/${mediaId}`, {
      method: "DELETE",
      token: accessToken,
    });
    if (res.ok) {
      setMediaItems((prev) => prev.filter((item) => item.id !== mediaId));
    }
  };

  const handleToggleLock = async (field: "lock_male" | "lock_female") => {
    if (!accessToken || !group) return;
    setLockUpdating(true);
    setLockStatus(null);
    const nextValue = !Boolean(group[field]);
    const res = await apiFetch(`/groups/${group.id}`, {
      method: "PUT",
      token: accessToken,
      body: JSON.stringify({ [field]: nextValue }),
    });
    if (res.ok) {
      setGroup(await res.json());
    } else {
      const payload = await res.json().catch(() => null);
      setLockStatus(payload?.detail || "Unable to update lock.");
    }
    setLockUpdating(false);
  };

  if (loading) {
    return <div className="mx-auto h-96 w-full max-w-3xl animate-pulse rounded-3xl bg-slate-200" />;
  }

  if (!group) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700">Group not found.</p>
        <Link href="/groups" className="mt-2 inline-block text-sm text-blue-600">
          Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href="/groups" className="text-sm text-blue-600">
          &lt;- Back to swipe
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{group.title}</h1>
        <p className="mt-2 text-slate-600">{group.description}</p>
        {group.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Activity</p>
          <p className="mt-2 font-semibold text-slate-800">{group.activity_type}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Location</p>
          <p className="mt-2 font-semibold text-slate-800">{group.location || "Flexible"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Cost</p>
          <p className="mt-2 font-semibold capitalize text-slate-800">
            {group.cost_type.replace("_", " ")}
          </p>
        </div>
      </div>

      {creator ? (
        <div id="creator" className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase text-slate-400">Creator</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {creator.profile_image_url ? (
              <img
                src={`${API_HOST}${creator.profile_image_url}`}
                alt={creator.full_name}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : null}
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {creator.full_name}
                {creator.username ? ` (@${creator.username})` : ""}
              </p>
              <p className="text-sm text-slate-600">
                {creator.verification_status === "verified" ? "Verified creator" : "Pending verification"}
              </p>
              <p className="text-xs text-slate-500">
                Reputation {creator.reputation_score ?? 0} - Safety {creator.safety_score ?? 0}
              </p>
            </div>
            {creator.badges?.length ? (
              <div className="flex flex-wrap gap-2">
                {creator.badges.map((badge) => (
                  <span key={badge} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {group.creator_intro ? (
            <p className="mt-4 text-sm text-slate-600">{group.creator_intro}</p>
          ) : null}
          {group.creator_intro_video_url ? (
            <a
              href={group.creator_intro_video_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm text-blue-600"
            >
              Watch intro video
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Members</p>
          <p className="mt-2 font-semibold text-slate-800">
            {group.approved_members ?? 0} / {group.max_participants}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Minimum needed</p>
          <p className="mt-2 font-semibold text-slate-800">{group.min_participants}</p>
        </div>
      </div>

      {user?.id === group.creator_id ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Gender locks</h2>
          <p className="mt-2 text-sm text-slate-600">
            Stop new join requests from a gender once you have enough members.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={lockUpdating}
              onClick={() => handleToggleLock("lock_male")}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {group.lock_male ? "Male locked" : "Lock male"}
            </Button>
            <Button
              type="button"
              disabled={lockUpdating}
              onClick={() => handleToggleLock("lock_female")}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {group.lock_female ? "Female locked" : "Lock female"}
            </Button>
          </div>
          {lockStatus ? <p className="mt-3 text-sm text-rose-600">{lockStatus}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">People in this group</h2>
        {approvedProfiles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No approved members yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {approvedProfiles.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                {member.profile_image_url ? (
                  <img
                    src={`${API_HOST}${member.profile_image_url}`}
                    alt={member.full_name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-slate-100" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{member.full_name}</p>
                  {member.username ? <p className="text-xs text-slate-500">@{member.username}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Group Gallery</h2>
        {mediaItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No media yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {mediaItems.map((media) => (
              <div key={media.id} className="relative overflow-hidden rounded-xl border border-slate-100">
                {media.media_type === "image" ? (
                  <img src={`${API_HOST}${media.url}`} alt="Group media" className="h-48 w-full object-cover" />
                ) : (
                  <video controls className="h-48 w-full object-cover" src={`${API_HOST}${media.url}`} />
                )}
                {user?.id === group.creator_id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(media.id)}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-blue-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {user?.id === group.creator_id ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => setMediaFiles(Array.from(event.target.files || []))}
            />
            <Button
              onClick={handleUploadMedia}
              disabled={mediaFiles.length === 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Upload media
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Requirements</h2>
        <div className="mt-4 space-y-4 text-sm text-slate-600">
          {group.requirements?.length ? (
            group.requirements.map((req, index) => (
              <div key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p>
                  Applies to: <span className="font-semibold text-slate-800">{req.applies_to}</span>
                </p>
                <p>
                  Age range: <span className="font-semibold text-slate-800">{req.min_age} - {req.max_age}</span>
                </p>
                {req.consent_flags && Object.keys(req.consent_flags).length > 0 ? (
                  <p className="mt-2">Consent flags required: {Object.keys(req.consent_flags).join(", ")}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p>No additional requirements.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Weekly Availability</h2>
        <div className="mt-4 grid gap-2">
          {WEEK_DAYS.map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-5 items-center gap-2">
              <span className="text-sm font-semibold text-slate-600">{day}</span>
              {DAY_SLOTS.map((slot) => {
                const key = `${dayIndex}-${slot}`;
                const active = availabilitySelection.has(key);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleToggleSlot(dayIndex, slot)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700" onClick={handleSaveAvailability}>
          Save availability
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <JoinRequestButton groupId={group.id} requirements={group.requirements || []} />
        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleLeave}>
          Leave Group
        </Button>
      </div>

      {user?.id === group.creator_id ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Members</h2>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={loadMembers}>
              Refresh
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {members
              .filter((member) => member.join_status === "approved")
              .map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <span className="text-sm text-slate-700">User #{member.user_id}</span>
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => handleRemove(member.user_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Plans & Polls</h2>
        {pinnedPlan ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-600">Pinned plan</p>
            <h3 className="mt-2 text-lg font-semibold text-emerald-800">{pinnedPlan.title}</h3>
            {pinnedPlan.details ? <p className="text-sm text-emerald-700">{pinnedPlan.details}</p> : null}
            {pinnedPlan.scheduled_at ? (
              <p className="text-xs text-emerald-700">{new Date(pinnedPlan.scheduled_at).toLocaleString()}</p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-100 p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Create a plan</p>
          <input
            value={planTitle}
            onChange={(event) => setPlanTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Plan title"
          />
          <textarea
            value={planDetails}
            onChange={(event) => setPlanDetails(event.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Plan details"
          />
          <input
            type="datetime-local"
            value={planScheduledAt}
            onChange={(event) => setPlanScheduledAt(event.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
          />
          <input
            value={planLocation}
            onChange={(event) => setPlanLocation(event.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Location name"
          />
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleCreatePlan}>
            Add plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-slate-500">No plans yet.</p>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{plan.title}</p>
                  <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => handlePinPlan(plan.id)}>
                    {plan.pinned ? "Pinned" : "Pin"}
                  </Button>
                </div>
                {plan.details ? <p className="text-xs text-slate-600">{plan.details}</p> : null}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-700">Create a poll</p>
          <input
            value={pollQuestion}
            onChange={(event) => setPollQuestion(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Where should we meet?"
          />
          <input
            value={pollOptions}
            onChange={(event) => setPollOptions(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Option A, Option B"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={pollIsMulti}
              onChange={(event) => setPollIsMulti(event.target.checked)}
            />
            Allow multiple choices
          </label>
          <Button className="mt-3 bg-blue-600 text-white hover:bg-blue-700" onClick={handleCreatePoll}>
            Publish poll
          </Button>
        </div>

        {polls.length === 0 ? (
          <p className="text-sm text-slate-500">No polls yet.</p>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <div key={poll.id} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-700">{poll.question}</p>
                <div className="mt-3 space-y-2">
                  {poll.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {poll.is_multi ? (
                          <input
                            type="checkbox"
                            checked={pollSelections[poll.id]?.has(option.id) || false}
                            onChange={() => togglePollSelection(poll.id, option.id)}
                          />
                        ) : null}
                        {option.label}
                      </span>
                      <span className="text-xs text-slate-500">{option.vote_count ?? 0} votes</span>
                      {!poll.is_multi ? (
                        <Button
                          size="sm"
                          className="bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => handleVotePoll(poll.id, [option.id])}
                        >
                          Vote
                        </Button>
                      ) : null}
                    </label>
                  ))}
                </div>
                {poll.is_multi ? (
                  <Button
                    className="mt-3 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() =>
                      handleVotePoll(poll.id, Array.from(pollSelections[poll.id] || []))
                    }
                  >
                    Submit votes
                  </Button>
                ) : null}
                {!poll.is_active ? (
                  <p className="mt-2 text-xs text-slate-400">Poll closed</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Map Pins</h2>
        <div className="mt-4 grid gap-3">
          {pins.length === 0 ? (
            <p className="text-sm text-slate-500">No pins yet.</p>
          ) : (
            pins.map((pin) => (
              <div key={pin.id} className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{pin.title}</p>
                {pin.description ? <p className="mt-1">{pin.description}</p> : null}
                {pin.lat && pin.lng ? (
                  <p className="mt-1 text-xs text-slate-500">{pin.lat}, {pin.lng}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 grid gap-2">
          <input
            value={pinTitle}
            onChange={(event) => setPinTitle(event.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Pin title"
          />
          <input
            value={pinDescription}
            onChange={(event) => setPinDescription(event.target.value)}
            className="rounded-lg border border-slate-200 p-2 text-sm"
            placeholder="Description"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={pinLat}
              onChange={(event) => setPinLat(event.target.value)}
              className="rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="Latitude"
            />
            <input
              value={pinLng}
              onChange={(event) => setPinLng(event.target.value)}
              className="rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="Longitude"
            />
          </div>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleCreatePin}>
            Add pin
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Group Chat</h2>
            <p className="text-sm text-slate-600">
              Continue the conversation in the dedicated chat room.
            </p>
          </div>
          <Link href={`/chat/${group.id}`}>
            <Button className="bg-blue-600 text-white hover:bg-blue-700">Open chat</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
