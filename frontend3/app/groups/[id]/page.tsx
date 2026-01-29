"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import JoinRequestButton, { GroupRequirement } from "@/components/groups/join-request-button";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cropImageToAspect } from "@/lib/image-processing";

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
  offerings?: string[] | null;
  rules?: string | string[] | null;
  expectations?: string | string[] | null;
  visibility?: string | null;
  status?: string | null;
  shared_tags?: string[] | null;
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
  request_message?: string | null;
  request_tier?: string | null;
}

interface MemberRequest {
  membership: MemberItem;
  user?: GroupMemberProfile | null;
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

interface PlanRSVPSummary {
  going: number;
  interested: number;
  not_going: number;
  user_status?: "going" | "interested" | "not_going" | null;
}

interface GroupAnnouncement {
  id: number;
  title: string;
  body?: string | null;
  created_at: string;
  created_by: number;
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
  profile_details?: Record<string, unknown> | null;
  profile_media?: Record<string, unknown> | null;
  last_active_at?: string | null;
}

interface GroupMemberProfile {
  id: number;
  full_name: string;
  username?: string | null;
  profile_image_url?: string | null;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SLOTS = ["morning", "afternoon", "evening", "night"];

export default function GroupDetailPage() {
  const params = useParams();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [mediaItems, setMediaItems] = useState<GroupMedia[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<File[]>([]);
  const [pendingMediaIndex, setPendingMediaIndex] = useState(0);
  const [pendingMediaPreview, setPendingMediaPreview] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const [isCoverUpload, setIsCoverUpload] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [availability, setAvailability] = useState<GroupAvailability[]>([]);
  const [plans, setPlans] = useState<GroupPlan[]>([]);
  const [planRsvps, setPlanRsvps] = useState<Record<number, PlanRSVPSummary>>({});
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [polls, setPolls] = useState<GroupPoll[]>([]);
  const [pins, setPins] = useState<GroupPin[]>([]);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [approvedProfiles, setApprovedProfiles] = useState<GroupMemberProfile[]>([]);
  const [planTitle, setPlanTitle] = useState("");
  const [planDetails, setPlanDetails] = useState("");
  const [planScheduledAt, setPlanScheduledAt] = useState("");
  const [planLocation, setPlanLocation] = useState("");
  const [planPinned, setPlanPinned] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Option 1, Option 2");
  const [pollIsMulti, setPollIsMulti] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState("");
  const [pollSelections, setPollSelections] = useState<Record<number, Set<number>>>({});
  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");
  const [availabilitySelection, setAvailabilitySelection] = useState<Set<string>>(new Set());
  const [lockStatus, setLockStatus] = useState<string | null>(null);
  const [lockUpdating, setLockUpdating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [isCreatingPin, setIsCreatingPin] = useState(false);
  const [pollVoteLoading, setPollVoteLoading] = useState<Record<number, boolean>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<number, boolean>>({});
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const { accessToken, user } = useAuth();

  const pinnedPlan = useMemo(() => plans.find((plan) => plan.pinned), [plans]);
  const isCreator = Boolean(group && user?.id && group.creator_id === user.id);
  const isMember = isCreator || approvedProfiles.some((member) => member.id === user?.id);
  const approvedCount =
    approvedProfiles.length > 0 ? approvedProfiles.length : group?.approved_members || 0;
  const creatorAvailability = (creator?.profile_details as Record<string, unknown> | null)
    ?.availability_windows as string[] | undefined;
  const creatorPhotoVerified = Boolean((creator?.profile_media as Record<string, unknown> | null)?.photo_verified);
  const creatorIdVerified = Boolean((creator?.profile_details as Record<string, unknown> | null)?.id_verified);
  const safetyContacts = ((user?.profile_details as Record<string, unknown> | null)
    ?.safety_contacts as { name: string; contact: string }[] | undefined) || [];
  const icebreakers = useMemo(() => {
    if (!group) return [];
    const prompts = [
      `What excites you about ${group.title}?`,
      group.activity_type ? `What should we plan for ${group.activity_type}?` : null,
      group.location ? `Have you been to ${group.location} before?` : null,
      group.tags && group.tags.length > 0
        ? `Which of these tags sounds most like you: ${group.tags.slice(0, 2).join(", ")}?`
        : null,
    ];
    return prompts.filter(Boolean).slice(0, 4) as string[];
  }, [group]);

  useEffect(() => {
    if (pendingMediaFiles.length === 0) {
      setPendingMediaPreview(null);
      return;
    }
    const file = pendingMediaFiles[pendingMediaIndex];
    if (!file) {
      setPendingMediaPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPendingMediaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingMediaFiles, pendingMediaIndex]);

  const pendingMediaFile = pendingMediaFiles[pendingMediaIndex];
  const pendingMediaIsImage = Boolean(pendingMediaFile?.type.startsWith("image/"));

  const handleSelectMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;
    setPendingMediaFiles(selected);
    setPendingMediaIndex(0);
    event.target.value = "";
  };

  const advancePendingMedia = () => {
    setPendingMediaIndex((prev) => {
      const next = prev + 1;
      if (next >= pendingMediaFiles.length) {
        setPendingMediaFiles([]);
        return 0;
      }
      return next;
    });
  };

  const handleAddMedia = async (mode: "original" | "crop") => {
    if (!pendingMediaFile) return;
    try {
      const fileToAdd =
        mode === "crop" && pendingMediaIsImage
          ? await cropImageToAspect(pendingMediaFile)
          : pendingMediaFile;
      setMediaFiles((prev) => [...prev, fileToAdd]);
      advancePendingMedia();
    } catch {
      setStatus("Unable to crop this media. Try another file.");
    }
  };

  const handleSkipMedia = () => {
    if (!pendingMediaFile) return;
    advancePendingMedia();
  };

  const handleCancelPendingMedia = () => {
    setPendingMediaFiles([]);
    setPendingMediaIndex(0);
    setPendingMediaPreview(null);
  };

  const loadMembers = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/members`, { token: accessToken });
    if (res.ok) {
      const data: MemberItem[] = await res.json();
      setMembers(data);
    }
  }, [accessToken, params.id]);

  const loadApprovedMembers = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/approved-members`, { token: accessToken });
    if (res.ok) {
      setApprovedProfiles(await res.json());
    }
  }, [accessToken, params.id]);

  const loadMemberRequests = useCallback(async () => {
    if (!accessToken || !isCreator) return;
    const res = await apiFetch(`/groups/${params.id}/members`, { token: accessToken });
    if (!res.ok) return;
    const memberships: MemberItem[] = await res.json();
    const pending = memberships.filter((item) => item.join_status === "requested");
    if (pending.length === 0) {
      setMemberRequests([]);
      return;
    }
    const usersCache: Record<number, GroupMemberProfile> = {};
    const nextRequests: MemberRequest[] = [];
    for (const membership of pending) {
      if (!usersCache[membership.user_id]) {
        const userRes = await apiFetch(`/users/${membership.user_id}`, { token: accessToken });
        if (userRes.ok) {
          usersCache[membership.user_id] = await userRes.json();
        }
      }
      nextRequests.push({
        membership,
        user: usersCache[membership.user_id],
      });
    }
    setMemberRequests(nextRequests);
  }, [accessToken, isCreator, params.id]);

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

  const loadMedia = useCallback(async () => {
    const res = await apiFetch(`/groups/${params.id}/media`);
    if (res.ok) {
      setMediaItems(await res.json());
    }
  }, [params.id]);

  const loadAvailability = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/availability`, { token: accessToken });
    if (res.ok) {
      const data: GroupAvailability[] = await res.json();
      setAvailability(data);
      const selections = new Set<string>();
      data.forEach((slot) => selections.add(`${slot.day_of_week}-${slot.slot}`));
      setAvailabilitySelection(selections);
    }
  }, [accessToken, params.id]);

  const loadPlans = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/plans`, { token: accessToken });
    if (res.ok) {
      setPlans(await res.json());
    }
  }, [accessToken, params.id]);

  const loadPlanRsvps = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/plans/rsvps`, { token: accessToken });
    if (res.ok) {
      setPlanRsvps(await res.json());
    }
  }, [accessToken, params.id]);

  const loadAnnouncements = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/announcements`, { token: accessToken });
    if (res.ok) {
      setAnnouncements(await res.json());
    }
  }, [accessToken, params.id]);

  const loadPolls = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/polls`, { token: accessToken });
    if (res.ok) {
      setPolls(await res.json());
    }
  }, [accessToken, params.id]);

  const loadPins = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/pins`, { token: accessToken });
    if (res.ok) {
      setPins(await res.json());
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    loadApprovedMembers();
  }, [loadApprovedMembers]);

  useEffect(() => {
    if (accessToken && group?.creator_id) {
      (async () => {
        const res = await apiFetch(`/users/${group.creator_id}`, { token: accessToken });
        if (res.ok) {
          setCreator(await res.json());
        }
      })();
    }
  }, [accessToken, group?.creator_id]);

  useEffect(() => {
    if (isCreator) {
      loadMembers();
      loadMemberRequests();
    }
  }, [isCreator, loadMembers, loadMemberRequests]);

  useEffect(() => {
    if (isMember) {
      loadAvailability();
      loadPlans();
      loadPlanRsvps();
      loadAnnouncements();
      loadPolls();
      loadPins();
    } else {
      setAvailability([]);
      setPlans([]);
      setPlanRsvps({});
      setAnnouncements([]);
      setPolls([]);
      setPins([]);
    }
  }, [
    isMember,
    loadAvailability,
    loadPlans,
    loadPlanRsvps,
    loadAnnouncements,
    loadPolls,
    loadPins,
  ]);

  const handleLeave = async () => {
    if (!accessToken) return;
    await apiFetch(`/groups/${params.id}/leave`, { method: "POST", token: accessToken });
  };

  const handleShareGroup = async () => {
    if (!group) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const message = `Join my group on Splendoure: ${group.title}${url ? `\n${url}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setStatus("Group link copied to clipboard.");
    } catch {
      setStatus("Unable to copy group link.");
    }
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

  const handleApproveRequest = async (userId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/approve/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadMemberRequests();
      await loadApprovedMembers();
    }
  };

  const handleRejectRequest = async (userId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/reject/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadMemberRequests();
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
    setIsCreatingPlan(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${params.id}/plans`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          title: planTitle,
          details: planDetails || undefined,
          scheduled_at: planScheduledAt || undefined,
          location_name: planLocation || undefined,
          pinned: planPinned,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to create plan.");
      }
      const created = await res.json();
      setPlans((prev) => [created, ...prev]);
      setPlanTitle("");
      setPlanDetails("");
      setPlanScheduledAt("");
      setPlanLocation("");
      setPlanPinned(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create plan.";
      setStatus(message);
    } finally {
      setIsCreatingPlan(false);
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

  const handleRsvpPlan = async (
    planId: number,
    statusValue: "going" | "interested" | "not_going"
  ) => {
    if (!accessToken) return;
    setRsvpLoading((prev) => ({ ...prev, [planId]: true }));
    try {
      const res = await apiFetch(`/groups/${params.id}/plans/${planId}/rsvp`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ status: statusValue }),
      });
      if (res.ok) {
        const summary: PlanRSVPSummary = await res.json();
        setPlanRsvps((prev) => ({ ...prev, [planId]: summary }));
      }
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [planId]: false }));
    }
  };

  const handleSharePlan = async (plan: GroupPlan) => {
    const contactLine =
      safetyContacts.length > 0
        ? `Trusted contacts: ${safetyContacts
            .map((contact) => `${contact.name} (${contact.contact})`)
            .join(", ")}`
        : "Trusted contacts: not set yet.";
    const message = [
      `Plan: ${plan.title}`,
      `Group: ${group?.title || "Splendoure group"}`,
      plan.scheduled_at ? `When: ${new Date(plan.scheduled_at).toLocaleString()}` : "When: TBD",
      plan.location_name ? `Where: ${plan.location_name}` : "Where: TBD",
      contactLine,
    ].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setStatus("Plan details copied to clipboard.");
    } catch {
      setStatus("Unable to copy plan details.");
    }
  };

  const handleSendReminder = async (planId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/plans/${planId}/remind`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      setStatus("Reminder sent.");
    } else {
      const data = await res.json().catch(() => null);
      setStatus(data?.detail || "Unable to send reminder.");
    }
  };

  const handleCreatePoll = async () => {
    if (!accessToken) return;
    if (!pollQuestion.trim()) {
      setStatus("Poll question is required.");
      return;
    }
    const options = pollOptions
      .split(",")
      .map((opt) => opt.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setStatus("Add at least two poll options.");
      return;
    }
    setIsCreatingPoll(true);
    setStatus(null);
    try {
      const closesAt = pollClosesAt.trim()
        ? new Date(pollClosesAt.trim()).toISOString()
        : undefined;
      const res = await apiFetch(`/groups/${params.id}/polls`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          question: pollQuestion.trim(),
          is_multi: pollIsMulti,
          closes_at: closesAt,
          options,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to create poll.");
      }
      const poll = await res.json();
      setPollQuestion("");
      setPollOptions("Option 1, Option 2");
      setPollClosesAt("");
      setPollIsMulti(false);
      setPolls((prev) => [poll, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create poll.";
      setStatus(message);
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleVotePoll = async (pollId: number, optionIds: number[]) => {
    if (!accessToken) return;
    if (optionIds.length === 0) {
      setStatus("Select at least one option before voting.");
      return;
    }
    setPollVoteLoading((prev) => ({ ...prev, [pollId]: true }));
    try {
      const res = await apiFetch(`/groups/${params.id}/polls/${pollId}/vote`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ option_ids: optionIds }),
      });
      if (res.ok) {
        await loadPolls();
      }
    } finally {
      setPollVoteLoading((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  const handleClosePoll = async (pollId: number) => {
    if (!accessToken) return;
    const res = await apiFetch(`/groups/${params.id}/polls/${pollId}/close`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadPolls();
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
    if (!pinTitle.trim()) {
      setStatus("Pin title is required.");
      return;
    }
    setIsCreatingPin(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${params.id}/pins`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          title: pinTitle.trim(),
          description: pinDescription.trim() || undefined,
          lat: pinLat ? Number(pinLat) : undefined,
          lng: pinLng ? Number(pinLng) : undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to create pin.");
      }
      const created = await res.json();
      setPins((prev) => [created, ...prev]);
      setPinTitle("");
      setPinDescription("");
      setPinLat("");
      setPinLng("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create pin.";
      setStatus(message);
    } finally {
      setIsCreatingPin(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!accessToken) return;
    if (!announcementTitle.trim()) {
      setStatus("Announcement title is required.");
      return;
    }
    setIsCreatingAnnouncement(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${params.id}/announcements`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          title: announcementTitle.trim(),
          body: announcementBody.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to post announcement.");
      }
      const created: GroupAnnouncement = await res.json();
      setAnnouncements((prev) => [created, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementBody("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to post announcement.";
      setStatus(message);
    } finally {
      setIsCreatingAnnouncement(false);
    }
  };

  const handleOpenMap = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return;
    window.open(`https://maps.google.com/?q=${lat},${lng}`, "_blank");
  };

  const handleUploadMedia = async () => {
    if (!accessToken || mediaFiles.length === 0) return;
    setIsUploadingMedia(true);
    try {
      for (const [index, file] of mediaFiles.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        if (isCoverUpload) {
          formData.append("is_cover", index === 0 ? "true" : "false");
        }
        await apiFetch(`/groups/${params.id}/media`, {
          method: "POST",
          token: accessToken,
          body: formData,
        });
      }
      setMediaFiles([]);
      setIsCoverUpload(false);
      const res = await apiFetch(`/groups/${params.id}/media`, { token: accessToken });
      if (res.ok) {
        setMediaItems(await res.json());
      }
    } finally {
      setIsUploadingMedia(false);
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
    return <div className="mx-auto h-96 w-full max-w-3xl animate-pulse rounded-none bg-slate-200 sm:rounded-3xl" />;
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
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Activity</p>
          <p className="mt-2 font-semibold text-slate-800">{group.activity_type}</p>
        </div>
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Location</p>
          <p className="mt-2 font-semibold text-slate-800">{group.location || "Flexible"}</p>
        </div>
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Cost</p>
          <p className="mt-2 font-semibold capitalize text-slate-800">
            {group.cost_type.replace("_", " ")}
          </p>
        </div>
      </div>

      {creator ? (
        <div id="creator" className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
          <p className="text-xs font-semibold uppercase text-slate-400">Creator</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {creator.profile_image_url ? (
              <img
                src={resolveMediaUrl(creator.profile_image_url)}
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
              {creatorPhotoVerified || creatorIdVerified ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {creatorPhotoVerified ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Photo verified
                    </span>
                  ) : null}
                  {creatorIdVerified ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      ID verified
                    </span>
                  ) : null}
                </div>
              ) : null}
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
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Members</p>
          <p className="mt-2 font-semibold text-slate-800">
            {group.approved_members ?? 0} / {group.max_participants}
          </p>
        </div>
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Minimum needed</p>
          <p className="mt-2 font-semibold text-slate-800">{group.min_participants}</p>
        </div>
      </div>

      {user?.id === group.creator_id ? (
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
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

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">People in this group</h2>
        {approvedProfiles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No approved members yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {approvedProfiles.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                {member.profile_image_url ? (
                  <img
                    src={resolveMediaUrl(member.profile_image_url)}
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

      {isCreator ? (
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Join requests</h2>
          {memberRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No pending requests.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {memberRequests.map(({ membership, user: requestUser }) => (
                <div key={membership.id} className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {requestUser?.full_name ||
                      requestUser?.username ||
                      `User ${membership.user_id}`}
                  </p>
                  {membership.request_tier === "superlike" ? (
                    <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Superlike
                    </span>
                  ) : null}
                  {membership.request_message ? (
                    <p className="mt-2 text-xs text-slate-600">{membership.request_message}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectRequest(membership.user_id)}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => handleApproveRequest(membership.user_id)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Group Gallery</h2>
        {mediaItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No media yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {mediaItems.map((media) => (
              <div key={media.id} className="w-[48%] space-y-1.5">
                {media.media_type === "image" ? (
                  <img
                    src={resolveMediaUrl(media.url)}
                    alt="Group media"
                    className="h-[140px] w-full rounded-2xl object-cover bg-slate-200"
                  />
                ) : (
                  <video
                    controls
                    className="h-[140px] w-full rounded-2xl object-cover bg-slate-200"
                    src={resolveMediaUrl(media.url)}
                  />
                )}
                <div className="flex items-center justify-between">
                  {media.is_cover ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
                      Cover
                    </span>
                  ) : (
                    <span />
                  )}
                  {user?.id === group.creator_id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(media.id)}
                      className="text-[12px] font-semibold text-rose-500"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {user?.id === group.creator_id ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleSelectMedia}
                ref={mediaInputRef}
                className="hidden"
              />
              <Button
                onClick={() => mediaInputRef.current?.click()}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Choose media
              </Button>
              <button
                type="button"
                onClick={() => setIsCoverUpload((prev) => !prev)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                  isCoverUpload
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Set as cover
              </button>
              <Button
                onClick={handleUploadMedia}
                disabled={mediaFiles.length === 0 || isUploadingMedia}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isUploadingMedia ? "Uploading..." : "Upload media"}
              </Button>
            </div>
            {mediaFiles.length > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                {mediaFiles.length} file(s) ready to upload
              </p>
            ) : null}
            {pendingMediaPreview ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">
                  Preview {pendingMediaIndex + 1} of {pendingMediaFiles.length}
                </p>
                {pendingMediaIsImage ? (
                  <img
                    src={pendingMediaPreview}
                    alt="Pending media"
                    className="mt-3 h-52 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="mt-3 flex h-40 w-full items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500">
                    Video selected
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleAddMedia("original")}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add to upload
                  </Button>
                  {pendingMediaIsImage ? (
                    <Button variant="outline" onClick={() => handleAddMedia("crop")}>
                      Crop & add
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSkipMedia}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPendingMedia}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Cancel all
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Only the group admin can upload media.</p>
        )}
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
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

      {icebreakers.length > 0 ? (
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Icebreakers</h2>
          <div className="mt-4 space-y-2">
            {icebreakers.map((prompt) => (
              <div key={prompt} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                {prompt}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Weekly Availability</h2>
        {!isMember ? (
          <p className="mt-3 text-sm text-slate-500">Join to see availability planning.</p>
        ) : (
          <>
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
                          active
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 text-slate-500"
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
          </>
        )}
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
        {!isMember ? (
          <p className="mt-3 text-sm text-slate-500">Join to see announcements.</p>
        ) : announcements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No announcements yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">{announcement.title}</p>
                {announcement.body ? <p className="mt-1 text-sm text-slate-600">{announcement.body}</p> : null}
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(announcement.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {isCreator ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">New announcement</p>
            <input
              value={announcementTitle}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="Announcement title"
            />
            <textarea
              value={announcementBody}
              onChange={(event) => setAnnouncementBody(event.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="Details (optional)"
            />
            <Button
              onClick={handleCreateAnnouncement}
              disabled={isCreatingAnnouncement}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isCreatingAnnouncement ? "Posting..." : "Post announcement"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {!isMember ? (
          <JoinRequestButton groupId={group.id} requirements={group.requirements || []} />
        ) : null}
        {isMember ? (
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleLeave}>
            Leave Group
          </Button>
        ) : null}
        <Button variant="outline" onClick={handleShareGroup}>
          Share group
        </Button>
      </div>

      {user?.id === group.creator_id ? (
        <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
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

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        {!isMember ? (
          <p className="text-sm text-slate-500">Join to see and create plans.</p>
        ) : (
          <>
            {pinnedPlan ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-600">Pinned plan</p>
                <h3 className="mt-2 text-lg font-semibold text-emerald-800">{pinnedPlan.title}</h3>
                {pinnedPlan.details ? (
                  <p className="text-sm text-emerald-700">{pinnedPlan.details}</p>
                ) : null}
                {pinnedPlan.scheduled_at ? (
                  <p className="text-xs text-emerald-700">
                    {new Date(pinnedPlan.scheduled_at).toLocaleString()}
                  </p>
                ) : null}
                {pinnedPlan.location_name ? (
                  <p className="text-xs text-emerald-700">{pinnedPlan.location_name}</p>
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
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={planPinned}
                  onChange={(event) => setPlanPinned(event.target.checked)}
                />
                Pin this plan
              </label>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleCreatePlan}
                disabled={isCreatingPlan}
              >
                {isCreatingPlan ? "Creating..." : "Add plan"}
              </Button>
            </div>

            {plans.length === 0 ? (
              <p className="text-sm text-slate-500">No plans yet.</p>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const rsvp = planRsvps[plan.id];
                  return (
                    <div key={plan.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">{plan.title}</p>
                        {plan.pinned ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Pinned
                          </span>
                        ) : null}
                      </div>
                      {plan.details ? <p className="text-xs text-slate-600">{plan.details}</p> : null}
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>
                          When: {plan.scheduled_at ? new Date(plan.scheduled_at).toLocaleString() : "TBD"}
                        </p>
                        {plan.location_name ? <p>Where: {plan.location_name}</p> : null}
                        {plan.location_lat != null && plan.location_lng != null ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-blue-600"
                            onClick={() => handleOpenMap(plan.location_lat, plan.location_lng)}
                          >
                            Open map
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>Going {rsvp?.going ?? 0}</span>
                        <span>Interested {rsvp?.interested ?? 0}</span>
                        <span>Not going {rsvp?.not_going ?? 0}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={rsvp?.user_status === "going" ? "default" : "outline"}
                          className={rsvp?.user_status === "going" ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}
                          onClick={() => handleRsvpPlan(plan.id, "going")}
                          disabled={rsvpLoading[plan.id]}
                        >
                          Going
                        </Button>
                        <Button
                          size="sm"
                          variant={rsvp?.user_status === "interested" ? "default" : "outline"}
                          className={rsvp?.user_status === "interested" ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}
                          onClick={() => handleRsvpPlan(plan.id, "interested")}
                          disabled={rsvpLoading[plan.id]}
                        >
                          Interested
                        </Button>
                        <Button
                          size="sm"
                          variant={rsvp?.user_status === "not_going" ? "default" : "outline"}
                          className={rsvp?.user_status === "not_going" ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}
                          onClick={() => handleRsvpPlan(plan.id, "not_going")}
                          disabled={rsvpLoading[plan.id]}
                        >
                          Not going
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSharePlan(plan)}>
                          Share
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isCreator && !plan.pinned ? (
                          <Button
                            size="sm"
                            className="bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => handlePinPlan(plan.id)}
                          >
                            Pin plan
                          </Button>
                        ) : null}
                        {isCreator ? (
                          <Button size="sm" variant="outline" onClick={() => handleSendReminder(plan.id)}>
                            Send reminder
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <h2 className="text-lg font-semibold text-slate-900">Polls</h2>
        {!isMember ? (
          <p className="text-sm text-slate-500">Join to see polls.</p>
        ) : (
          <>
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
              <input
                type="datetime-local"
                value={pollClosesAt}
                onChange={(event) => setPollClosesAt(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={pollIsMulti}
                  onChange={(event) => setPollIsMulti(event.target.checked)}
                />
                Allow multiple choices
              </label>
              <Button
                className="mt-3 bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleCreatePoll}
                disabled={isCreatingPoll}
              >
                {isCreatingPoll ? "Publishing..." : "Publish poll"}
              </Button>
            </div>

            {polls.length === 0 ? (
              <p className="text-sm text-slate-500">No polls yet.</p>
            ) : (
              <div className="space-y-4">
                {polls.map((poll) => (
                  <div key={poll.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">{poll.question}</p>
                      {isCreator && poll.is_active ? (
                        <Button size="sm" variant="outline" onClick={() => handleClosePoll(poll.id)}>
                          Close
                        </Button>
                      ) : null}
                    </div>
                    {poll.closes_at ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Closes {new Date(poll.closes_at).toLocaleString()}
                      </p>
                    ) : null}
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
                              disabled={pollVoteLoading[poll.id]}
                            >
                              {pollVoteLoading[poll.id] ? "Voting..." : "Vote"}
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
                        disabled={pollVoteLoading[poll.id]}
                      >
                        {pollVoteLoading[poll.id] ? "Submitting..." : "Submit votes"}
                      </Button>
                    ) : null}
                    {!poll.is_active ? (
                      <p className="mt-2 text-xs text-slate-400">Poll closed</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Map Pins</h2>
        {!isMember ? (
          <p className="mt-3 text-sm text-slate-500">Join to add shared pins.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              {pins.length === 0 ? (
                <p className="text-sm text-slate-500">No pins yet.</p>
              ) : (
                pins.map((pin) => (
                  <div key={pin.id} className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">{pin.title}</p>
                    {pin.description ? <p className="mt-1">{pin.description}</p> : null}
                    {pin.lat != null && pin.lng != null ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-blue-600"
                        onClick={() => handleOpenMap(pin.lat, pin.lng)}
                      >
                        Open map
                      </button>
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
          </>
        )}
      </div>

      <div className="rounded-none border-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Group Chat</h2>
            <p className="text-sm text-slate-600">
              Continue the conversation in the dedicated chat room.
            </p>
          </div>
          {isMember ? (
            <Link href={`/chat/${group.id}`}>
              <Button className="bg-blue-600 text-white hover:bg-blue-700">Open chat</Button>
            </Link>
          ) : (
            <p className="text-sm text-slate-500">Join to access the group chat.</p>
          )}
        </div>
      </div>
      {status ? <p className="text-center text-sm text-slate-500">{status}</p> : null}
    </div>
  );
}

