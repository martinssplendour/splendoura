"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";

import { BottomNav, BOTTOM_NAV_HEIGHT } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { apiFetch, API_HOST } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { buildFormFile, type UploadAsset } from "@/lib/uploads";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVAILABILITY_SLOTS = ["Morning", "Afternoon", "Evening"];

interface GroupRequirement {
  applies_to: string;
  min_age: number;
  max_age: number;
  additional_requirements?: string | null;
  consent_flags?: Record<string, boolean>;
}

interface GroupDetail {
  id: number;
  creator_id: number;
  title: string;
  description: string;
  activity_type: string;
  category: string;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  min_participants: number;
  max_participants: number;
  cost_type: string;
  offerings?: string[] | null;
  rules?: string | null;
  expectations?: string | string[] | null;
  tags?: string[] | null;
  creator_intro?: string | null;
  creator_intro_video_url?: string | null;
  lock_male: boolean;
  lock_female: boolean;
  visibility: string;
  status: string;
  requirements?: GroupRequirement[] | null;
  approved_members?: number | null;
  cover_image_url?: string | null;
  shared_tags?: string[] | null;
}

interface MemberProfile {
  id: number;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
  last_active_at?: string | null;
  profile_media?: {
    photo_verified?: boolean;
  } | null;
  profile_details?: Record<string, unknown> | null;
}

interface MembershipItem {
  id: number;
  user_id: number;
  group_id: number;
  join_status: "requested" | "approved" | "rejected";
  role: "creator" | "member";
  request_message?: string | null;
  request_tier?: string | null;
}

interface MemberRequest {
  membership: MembershipItem;
  user?: MemberProfile | null;
}

interface GroupMedia {
  id: number;
  group_id: number;
  uploader_id: number;
  url: string;
  media_type: "image" | "video";
  is_cover: boolean;
  created_at: string;
}

interface GroupAvailability {
  id: number;
  group_id: number;
  day_of_week: number;
  slot: string;
  created_by: number;
}

interface GroupPlan {
  id: number;
  group_id: number;
  title: string;
  details?: string | null;
  scheduled_at?: string | null;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  pinned: boolean;
  created_by: number;
}

interface GroupAnnouncement {
  id: number;
  group_id: number;
  title: string;
  body?: string | null;
  created_by: number;
  created_at: string;
}

interface PlanRSVPSummary {
  going: number;
  interested: number;
  not_going: number;
  user_status?: "going" | "interested" | "not_going" | null;
}

interface GroupPollOption {
  id: number;
  label: string;
  vote_count?: number | null;
}

interface GroupPoll {
  id: number;
  group_id: number;
  question: string;
  is_multi: boolean;
  closes_at?: string | null;
  is_active: boolean;
  created_by: number;
  options: GroupPollOption[];
}

interface GroupPin {
  id: number;
  group_id: number;
  title: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_by: number;
}

const formatDate = (value?: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatLastActive = (value?: string | null) => {
  if (!value) return "Active recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Active recently";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 10) return "Active now";
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  return `Active ${date.toLocaleDateString()}`;
};

const toAbsoluteUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return `${API_HOST}${value}`;
};

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user, isLoading } = useAuth();
  const groupId = useMemo(() => Number(params.id), [params.id]);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [creator, setCreator] = useState<MemberProfile | null>(null);
  const [approvedMembers, setApprovedMembers] = useState<MemberProfile[]>([]);
  const [memberRequests, setMemberRequests] = useState<MemberRequest[]>([]);
  const [media, setMedia] = useState<GroupMedia[]>([]);
  const [availability, setAvailability] = useState<GroupAvailability[]>([]);
  const [availabilitySelection, setAvailabilitySelection] = useState<Record<string, boolean>>({});
  const [plans, setPlans] = useState<GroupPlan[]>([]);
  const [planRsvps, setPlanRsvps] = useState<Record<number, PlanRSVPSummary>>({});
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [polls, setPolls] = useState<GroupPoll[]>([]);
  const [pins, setPins] = useState<GroupPin[]>([]);
  const [pollSelections, setPollSelections] = useState<Record<number, number[]>>({});
  const [consentSelections, setConsentSelections] = useState<Record<string, boolean>>({});
  const [joinMessage, setJoinMessage] = useState("");

  const [selectedMedia, setSelectedMedia] = useState<UploadAsset | null>(null);
  const [isCoverUpload, setIsCoverUpload] = useState(false);

  const [planTitle, setPlanTitle] = useState("");
  const [planDetails, setPlanDetails] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planLocation, setPlanLocation] = useState("");
  const [planPinned, setPlanPinned] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsText, setPollOptionsText] = useState("");
  const [pollMulti, setPollMulti] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState("");

  const [pinTitle, setPinTitle] = useState("");
  const [pinDescription, setPinDescription] = useState("");
  const [pinLat, setPinLat] = useState("");
  const [pinLng, setPinLng] = useState("");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [isCreatingPin, setIsCreatingPin] = useState(false);
  const [pollVoteLoading, setPollVoteLoading] = useState<Record<number, boolean>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<number, boolean>>({});

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  const isCreator = Boolean(group && user?.id && group.creator_id === user.id);
  const isMember = isCreator || approvedMembers.some((member) => member.id === user?.id);
  const approvedCount =
    approvedMembers.length > 0 ? approvedMembers.length : group?.approved_members || 0;
  const creatorAvailability = (creator?.profile_details as Record<string, unknown> | null)
    ?.availability_windows as string[] | undefined;
  const creatorPhotoVerified = Boolean(creator?.profile_media?.photo_verified);
  const creatorIdVerified = Boolean(
    (creator?.profile_details as Record<string, unknown> | null)?.id_verified
  );
  const safetyContacts = ((user?.profile_details as Record<string, unknown> | null)
    ?.safety_contacts as { name: string; contact: string }[] | undefined) || [];

  const activeRequirement = useMemo(() => {
    const requirements = group?.requirements || [];
    if (requirements.length === 0) return null;
    if (!user?.gender) return requirements[0];
    return (
      requirements.find((req) => req.applies_to === user.gender) ||
      requirements.find((req) => req.applies_to === "all") ||
      requirements[0]
    );
  }, [group?.requirements, user?.gender]);

  const consentKeys = useMemo(() => {
    if (!activeRequirement?.consent_flags) return [];
    return Object.keys(activeRequirement.consent_flags);
  }, [activeRequirement]);

  const requiredConsentKeys = useMemo(() => {
    if (!activeRequirement?.consent_flags) return [];
    return Object.entries(activeRequirement.consent_flags)
      .filter(([, required]) => required)
      .map(([key]) => key);
  }, [activeRequirement]);

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
  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(
      `/groups/${groupId}`,
      accessToken ? { token: accessToken } : undefined
    );
    if (res.ok) {
      const data: GroupDetail = await res.json();
      setGroup(data);
    } else {
      setStatus("Unable to load group details.");
    }
  }, [accessToken, groupId]);

  const loadCreator = useCallback(
    async (creatorId: number) => {
      if (!accessToken) return;
      if (user && user.id === creatorId) {
        setCreator({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          profile_image_url: user.profile_image_url,
          email: user.email,
          last_active_at: user.last_active_at ?? null,
          profile_details: user.profile_details ?? null,
        });
        return;
      }
      const res = await apiFetch(`/users/${creatorId}`, { token: accessToken });
      if (res.ok) {
        const data: MemberProfile = await res.json();
        setCreator(data);
      }
    },
    [accessToken, user]
  );

  const loadApprovedMembers = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/approved-members`, { token: accessToken });
    if (res.ok) {
      const data: MemberProfile[] = await res.json();
      setApprovedMembers(data);
    }
  }, [accessToken, groupId]);

  const loadMemberRequests = useCallback(async () => {
    if (!accessToken || !groupId || !isCreator) return;
    const res = await apiFetch(`/groups/${groupId}/members`, { token: accessToken });
    if (!res.ok) return;
    const memberships: MembershipItem[] = await res.json();
    const pending = memberships.filter((item) => item.join_status === "requested");
    if (pending.length === 0) {
      setMemberRequests([]);
      return;
    }
    const usersCache: Record<number, MemberProfile> = {};
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
  }, [accessToken, groupId, isCreator]);

  const loadMedia = useCallback(async () => {
    if (!groupId) return;
    const res = await apiFetch(`/groups/${groupId}/media`);
    if (res.ok) {
      const data: GroupMedia[] = await res.json();
      setMedia(data);
    }
  }, [groupId]);

  const loadAvailability = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/availability`, { token: accessToken });
    if (res.ok) {
      const data: GroupAvailability[] = await res.json();
      setAvailability(data);
    }
  }, [accessToken, groupId]);

  const loadPlans = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/plans`, { token: accessToken });
    if (res.ok) {
      const data: GroupPlan[] = await res.json();
      setPlans(data);
    }
  }, [accessToken, groupId]);

  const loadPlanRsvps = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/plans/rsvps`, { token: accessToken });
    if (res.ok) {
      const data: Record<number, PlanRSVPSummary> = await res.json();
      setPlanRsvps(data);
    }
  }, [accessToken, groupId]);

  const loadAnnouncements = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/announcements`, { token: accessToken });
    if (res.ok) {
      const data: GroupAnnouncement[] = await res.json();
      setAnnouncements(data);
    }
  }, [accessToken, groupId]);

  const loadPolls = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/polls`, { token: accessToken });
    if (res.ok) {
      const data: GroupPoll[] = await res.json();
      setPolls(data);
    }
  }, [accessToken, groupId]);

  const loadPins = useCallback(async () => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/pins`, { token: accessToken });
    if (res.ok) {
      const data: GroupPin[] = await res.json();
      setPins(data);
    }
  }, [accessToken, groupId]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!groupId) return;
      setLoading(true);
      await loadGroup();
      await loadMedia();
      if (active) {
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [groupId, loadGroup, loadMedia]);

  useEffect(() => {
    if (group?.creator_id && accessToken) {
      loadCreator(group.creator_id);
    }
  }, [accessToken, group?.creator_id, loadCreator]);

  useEffect(() => {
    loadApprovedMembers();
  }, [loadApprovedMembers]);

  useEffect(() => {
    if (isCreator) {
      loadMemberRequests();
    }
  }, [isCreator, loadMemberRequests]);

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
  }, [isMember, loadAnnouncements, loadAvailability, loadPlanRsvps, loadPlans, loadPolls, loadPins]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    availability.forEach((slot) => {
      next[`${slot.day_of_week}|${slot.slot}`] = true;
    });
    setAvailabilitySelection(next);
  }, [availability]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStatus(null);
    await loadGroup();
    await loadMedia();
    await loadApprovedMembers();
    if (isCreator) {
      await loadMemberRequests();
    }
    if (isMember) {
      await loadAvailability();
      await loadPlans();
      await loadPlanRsvps();
      await loadAnnouncements();
      await loadPolls();
      await loadPins();
    }
    setIsRefreshing(false);
  };

  const handleToggleConsent = (key: string) => {
    setConsentSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleJoinRequest = async () => {
    if (!accessToken || !groupId) return;
    if (!user?.profile_image_url) {
      setStatus("Upload a profile photo before requesting to join.");
      return;
    }
    if (joinMessage.trim().length > 500) {
      setStatus("Join message must be 500 characters or less.");
      return;
    }
    if (requiredConsentKeys.some((key) => !consentSelections[key])) {
      setStatus("Please accept the required consent checks.");
      return;
    }
    setIsJoining(true);
    setStatus(null);
    try {
      const consentFlags: Record<string, boolean> = {};
      consentKeys.forEach((key) => {
        consentFlags[key] = Boolean(consentSelections[key]);
      });
      const res = await apiFetch(`/groups/${groupId}/join`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          consent_flags: consentFlags,
          request_message: joinMessage.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to request to join.");
      }
      const payload = await res.json().catch(() => null);
      setStatus(payload?.msg || "Join request sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to request to join.";
      setStatus(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!accessToken || !groupId) return;
    setIsLeaving(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${groupId}/leave`, {
        method: "POST",
        token: accessToken,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to leave group.");
      }
      setStatus("You left the group.");
      await loadApprovedMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to leave group.";
      setStatus(message);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleApprove = async (userId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/approve/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadMemberRequests();
      await loadApprovedMembers();
    }
  };

  const handleReject = async (userId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/reject/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadMemberRequests();
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/remove/${userId}`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadApprovedMembers();
    }
  };

  const handleToggleLock = async (key: "lock_male" | "lock_female") => {
    if (!accessToken || !groupId || !group) return;
    const nextValue = key === "lock_male" ? !group.lock_male : !group.lock_female;
    const res = await apiFetch(`/groups/${groupId}`, {
      method: "PUT",
      token: accessToken,
      body: JSON.stringify({ [key]: nextValue }),
    });
    if (res.ok) {
      const data: GroupDetail = await res.json();
      setGroup(data);
    }
  };
  const handlePickMedia = async () => {
    if (!isCreator) {
      setStatus("Only the group admin can upload media.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSelectedMedia({
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const handleUploadMedia = async () => {
    if (!accessToken || !groupId || !selectedMedia) return;
    if (!isCreator) {
      setStatus("Only the group admin can upload media.");
      return;
    }
    setIsUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", buildFormFile(selectedMedia) as unknown as Blob);
      formData.append("is_cover", isCoverUpload ? "true" : "false");
      const res = await apiFetch(`/groups/${groupId}/media`, {
        method: "POST",
        token: accessToken,
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Media upload failed.");
      }
      setSelectedMedia(null);
      setIsCoverUpload(false);
      await loadMedia();
      if (isCoverUpload) {
        await loadGroup();
      }
      setStatus("Media uploaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Media upload failed.";
      setStatus(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/media/${mediaId}`, {
      method: "DELETE",
      token: accessToken,
    });
    if (res.ok) {
      await loadMedia();
      await loadGroup();
    }
  };

  const handleToggleSlot = (dayIndex: number, slot: string) => {
    const key = `${dayIndex}|${slot}`;
    setAvailabilitySelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveAvailability = async () => {
    if (!accessToken || !groupId) return;
    setIsSavingAvailability(true);
    setStatus(null);
    try {
      const selected = Object.entries(availabilitySelection)
        .filter(([, selected]) => selected)
        .map(([key]) => {
          const [day, slot] = key.split("|");
          return { day_of_week: Number(day), slot };
        });
      const res = await apiFetch(`/groups/${groupId}/availability`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(selected),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to save availability.");
      }
      const data: GroupAvailability[] = await res.json();
      setAvailability(data);
      setStatus("Availability saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save availability.";
      setStatus(message);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!accessToken || !groupId) return;
    if (!planTitle.trim()) {
      setStatus("Plan title is required.");
      return;
    }
    setIsCreatingPlan(true);
    setStatus(null);
    try {
      let scheduledAt: string | undefined;
      if (planDate.trim()) {
        const parsed = new Date(planDate.trim());
        scheduledAt = Number.isNaN(parsed.getTime()) ? planDate.trim() : parsed.toISOString();
      }
      const payload = {
        title: planTitle.trim(),
        details: planDetails.trim() || undefined,
        scheduled_at: scheduledAt,
        location_name: planLocation.trim() || undefined,
        pinned: planPinned,
      };
      const res = await apiFetch(`/groups/${groupId}/plans`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to create plan.");
      }
      setPlanTitle("");
      setPlanDetails("");
      setPlanDate("");
      setPlanLocation("");
      setPlanPinned(false);
      await loadPlans();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create plan.";
      setStatus(message);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handlePinPlan = async (planId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/plans/${planId}/pin`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadPlans();
    }
  };

  const handleRsvpPlan = async (planId: number, status: "going" | "interested" | "not_going") => {
    if (!accessToken || !groupId) return;
    setRsvpLoading((prev) => ({ ...prev, [planId]: true }));
    try {
      const res = await apiFetch(`/groups/${groupId}/plans/${planId}/rsvp`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const summary: PlanRSVPSummary = await res.json();
        setPlanRsvps((prev) => ({ ...prev, [planId]: summary }));
      }
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [planId]: false }));
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!accessToken || !groupId) return;
    if (!announcementTitle.trim()) {
      setStatus("Announcement title is required.");
      return;
    }
    setIsCreatingAnnouncement(true);
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${groupId}/announcements`, {
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

  const handleSharePlan = async (plan: GroupPlan) => {
    const contactLine =
      safetyContacts.length > 0
        ? `Trusted contacts: ${safetyContacts
            .map((contact) => `${contact.name} (${contact.contact})`)
            .join(", ")}`
        : "Trusted contacts: not set yet.";
    const message = [
      `Plan: ${plan.title}`,
      `Group: ${group?.title || "Splendoura group"}`,
      plan.scheduled_at ? `When: ${formatDateTime(plan.scheduled_at)}` : "When: TBD",
      plan.location_name ? `Where: ${plan.location_name}` : "Where: TBD",
      contactLine,
    ].join("\n");
    await Share.share({ message });
  };

  const handleSendReminder = async (planId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/plans/${planId}/remind`, {
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

  const togglePollSelection = (pollId: number, optionId: number, isMulti: boolean) => {
    setPollSelections((prev) => {
      const existing = prev[pollId] || [];
      if (isMulti) {
        if (existing.includes(optionId)) {
          return { ...prev, [pollId]: existing.filter((id) => id !== optionId) };
        }
        return { ...prev, [pollId]: [...existing, optionId] };
      }
      return { ...prev, [pollId]: [optionId] };
    });
  };

  const handleVotePoll = async (pollId: number) => {
    if (!accessToken || !groupId) return;
    const selections = pollSelections[pollId] || [];
    if (selections.length === 0) {
      setStatus("Select at least one option before voting.");
      return;
    }
    setPollVoteLoading((prev) => ({ ...prev, [pollId]: true }));
    setStatus(null);
    try {
      const res = await apiFetch(`/groups/${groupId}/polls/${pollId}/vote`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ option_ids: selections }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Unable to vote.");
      }
      await loadPolls();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to vote.";
      setStatus(message);
    } finally {
      setPollVoteLoading((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  const handleClosePoll = async (pollId: number) => {
    if (!accessToken || !groupId) return;
    const res = await apiFetch(`/groups/${groupId}/polls/${pollId}/close`, {
      method: "POST",
      token: accessToken,
    });
    if (res.ok) {
      await loadPolls();
    }
  };

  const handleCreatePoll = async () => {
    if (!accessToken || !groupId) return;
    if (!pollQuestion.trim()) {
      setStatus("Poll question is required.");
      return;
    }
    const options = pollOptionsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setStatus("Add at least two poll options.");
      return;
    }
    setIsCreatingPoll(true);
    setStatus(null);
    try {
      let closesAt: string | undefined;
      if (pollClosesAt.trim()) {
        const parsed = new Date(pollClosesAt.trim());
        closesAt = Number.isNaN(parsed.getTime()) ? pollClosesAt.trim() : parsed.toISOString();
      }
      const payload = {
        question: pollQuestion.trim(),
        is_multi: pollMulti,
        closes_at: closesAt,
        options,
      };
      const res = await apiFetch(`/groups/${groupId}/polls`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to create poll.");
      }
      setPollQuestion("");
      setPollOptionsText("");
      setPollClosesAt("");
      setPollMulti(false);
      await loadPolls();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create poll.";
      setStatus(message);
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleCreatePin = async () => {
    if (!accessToken || !groupId) return;
    if (!pinTitle.trim()) {
      setStatus("Pin title is required.");
      return;
    }
    setIsCreatingPin(true);
    setStatus(null);
    try {
      const lat = pinLat.trim() ? Number(pinLat) : undefined;
      const lng = pinLng.trim() ? Number(pinLng) : undefined;
      const payload = {
        title: pinTitle.trim(),
        description: pinDescription.trim() || undefined,
        lat: Number.isNaN(lat as number) ? undefined : lat,
        lng: Number.isNaN(lng as number) ? undefined : lng,
      };
      const res = await apiFetch(`/groups/${groupId}/pins`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Unable to create pin.");
      }
      setPinTitle("");
      setPinDescription("");
      setPinLat("");
      setPinLng("");
      await loadPins();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create pin.";
      setStatus(message);
    } finally {
      setIsCreatingPin(false);
    }
  };

  const handleOpenMap = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return;
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };
  if (loading || isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.status}>Group not found.</Text>
          <Button variant="outline" onPress={() => router.push("/groups")}>
            Back to groups
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const coverUrl = toAbsoluteUrl(group.cover_image_url);
  const memberLabel = `${approvedCount}/${group.max_participants} members`;
  const activeLabel = creator?.last_active_at ? formatLastActive(creator.last_active_at) : "Active";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={[styles.container, styles.containerWithNav]}>
          <View style={styles.topRow}>
            <Button variant="outline" size="sm" onPress={() => router.back()}>
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </View>

          <View style={styles.header}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.headerText}>
              <Text style={styles.title}>{group.title}</Text>
              <Text style={styles.subtitle}>{group.description}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaPill}>{group.category.replace("_", " ")}</Text>
                <Text style={styles.metaPill}>{group.status}</Text>
                <Text style={styles.metaPill}>{group.visibility}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Group details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Activity</Text>
              <Text style={styles.detailValue}>{group.activity_type || "Not set"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{group.location || group.destination || "TBD"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dates</Text>
              <Text style={styles.detailValue}>
                {formatDate(group.start_date)} to {formatDate(group.end_date)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Participants</Text>
              <Text style={styles.detailValue}>
                {group.min_participants} to {group.max_participants}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cost type</Text>
              <Text style={styles.detailValue}>{group.cost_type}</Text>
            </View>
            {group.offerings && group.offerings.length > 0 ? (
              <View style={styles.chipRow}>
                {group.offerings.map((item) => (
                  <Text key={item} style={styles.chip}>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {group.tags && group.tags.length > 0 ? (
              <View style={styles.chipRow}>
                {group.tags.map((item) => (
                  <Text key={item} style={styles.chipMuted}>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
            {group.rules ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Rules</Text>
                <Text style={styles.detailValue}>{group.rules}</Text>
              </View>
            ) : null}
            {group.expectations ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Expectations</Text>
                <Text style={styles.detailValue}>
                  {Array.isArray(group.expectations)
                    ? group.expectations.join(", ")
                    : group.expectations}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Creator</Text>
            <View style={styles.creatorRow}>
              {creator?.profile_image_url ? (
                <Image
                  source={{ uri: toAbsoluteUrl(creator.profile_image_url) || undefined }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
              <View style={styles.creatorBody}>
                <Text style={styles.creatorName}>
                  {creator?.username || creator?.full_name || `User ${group.creator_id}`}
                </Text>
                <Text style={styles.creatorMeta}>{memberLabel} · {activeLabel}</Text>
                {(creatorPhotoVerified || creatorIdVerified) ? (
                  <View style={styles.badgeRow}>
                    {creatorPhotoVerified ? (
                      <Text style={styles.badge}>Photo verified</Text>
                    ) : null}
                    {creatorIdVerified ? <Text style={styles.badge}>ID verified</Text> : null}
                  </View>
                ) : null}
              </View>
              {accessToken ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/users/${group.creator_id}`)}
                >
                  View
                </Button>
              ) : null}
            </View>
            {group.creator_intro ? (
              <Text style={styles.detailValue}>{group.creator_intro}</Text>
            ) : null}
            {creatorAvailability && creatorAvailability.length > 0 ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Availability</Text>
                <Text style={styles.detailValue}>{creatorAvailability.join(", ")}</Text>
              </View>
            ) : null}
            {group.creator_intro_video_url ? (
              <Pressable onPress={() => Linking.openURL(group.creator_intro_video_url)}>
                <Text style={styles.link}>Open intro video</Text>
              </Pressable>
            ) : null}
            {isCreator ? (
              <View style={styles.lockRow}>
                <Pressable
                  style={[styles.toggle, group.lock_male ? styles.toggleActive : null]}
                  onPress={() => handleToggleLock("lock_male")}
                >
                  <Text
                    style={[styles.toggleText, group.lock_male ? styles.toggleTextActive : null]}
                  >
                    {group.lock_male ? "Male locked" : "Allow male"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toggle, group.lock_female ? styles.toggleActive : null]}
                  onPress={() => handleToggleLock("lock_female")}
                >
                  <Text
                    style={[styles.toggleText, group.lock_female ? styles.toggleTextActive : null]}
                  >
                    {group.lock_female ? "Female locked" : "Allow female"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            {group.requirements && group.requirements.length > 0 ? (
              group.requirements.map((req, index) => (
                <View key={`${req.applies_to}-${index}`} style={styles.requirementCard}>
                  <Text style={styles.requirementTitle}>Applies to: {req.applies_to}</Text>
                  <Text style={styles.detailValue}>
                    Ages {req.min_age} to {req.max_age}
                  </Text>
                  {req.additional_requirements ? (
                    <Text style={styles.detailValue}>{req.additional_requirements}</Text>
                  ) : null}
                  {req.consent_flags && Object.keys(req.consent_flags).length > 0 ? (
                    <View style={styles.consentList}>
                      {Object.entries(req.consent_flags).map(([key, required]) => (
                        <Text key={key} style={styles.consentItem}>
                          {key} {required ? "(required)" : "(optional)"}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.detailValue}>No special requirements listed.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Join status</Text>
            {!accessToken ? (
              <View style={styles.centeredRow}>
                <Text style={styles.detailValue}>Sign in to request to join.</Text>
                <Button onPress={() => router.push("/auth/login")}>Sign in</Button>
              </View>
            ) : isCreator ? (
              <Text style={styles.detailValue}>You are the creator of this group.</Text>
            ) : isMember ? (
              <View style={styles.centeredRow}>
                <Text style={styles.detailValue}>You are an approved member.</Text>
                <Button variant="outline" onPress={handleLeave} disabled={isLeaving}>
                  {isLeaving ? "Leaving..." : "Leave group"}
                </Button>
              </View>
            ) : (
              <View style={styles.joinSection}>
                {consentKeys.length > 0 ? (
                  <View>
                    <Text style={styles.detailLabel}>Consent checks</Text>
                    <View style={styles.consentToggleList}>
                      {consentKeys.map((key) => {
                        const required =
                          activeRequirement?.consent_flags &&
                          activeRequirement.consent_flags[key];
                        return (
                          <Pressable
                            key={key}
                            style={[
                              styles.checkboxRow,
                              consentSelections[key] ? styles.checkboxRowActive : null,
                            ]}
                            onPress={() => handleToggleConsent(key)}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                consentSelections[key] ? styles.checkboxActive : null,
                              ]}
                            />
                            <Text style={styles.checkboxLabel}>
                              {key}
                              {required ? " (required)" : " (optional)"}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <View>
                  <Text style={styles.detailLabel}>Add a note to your request</Text>
                  <TextInput
                    value={joinMessage}
                    onChangeText={setJoinMessage}
                    placeholder="Introduce yourself or share why you'd be a great fit."
                    style={[styles.input, styles.multiline]}
                    multiline
                  />
                </View>
                <Button onPress={handleJoinRequest} disabled={isJoining}>
                  {isJoining ? "Sending..." : "Request to join"}
                </Button>
              </View>
            )}
          </View>

          {icebreakers.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Icebreakers</Text>
              <View style={styles.listStack}>
                {icebreakers.map((prompt) => (
                  <View key={prompt} style={styles.icebreakerRow}>
                    <Text style={styles.detailValue}>{prompt}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Members</Text>
            {!accessToken ? (
              <Text style={styles.detailValue}>Sign in to see member profiles.</Text>
            ) : approvedMembers.length === 0 ? (
              <Text style={styles.detailValue}>No approved members listed yet.</Text>
            ) : (
              <View style={styles.memberGrid}>
                {approvedMembers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    {member.profile_image_url ? (
                      <Image
                        source={{ uri: toAbsoluteUrl(member.profile_image_url) || undefined }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder} />
                    )}
                    <Text style={styles.memberName}>
                      {member.username || member.full_name || `User ${member.id}`}
                    </Text>
                    {isCreator && member.id !== group.creator_id ? (
                      <Pressable onPress={() => handleRemoveMember(member.id)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            {isCreator ? (
              <View style={styles.requestSection}>
                <Text style={styles.sectionSubtitle}>Join requests</Text>
                {memberRequests.length === 0 ? (
                  <Text style={styles.detailValue}>No pending requests.</Text>
                ) : (
                  memberRequests.map(({ membership, user: requestUser }) => (
                    <View key={membership.id} style={styles.requestCard}>
                      <Text style={styles.requestTitle}>
                        {requestUser?.full_name ||
                          requestUser?.username ||
                          `User ${membership.user_id}`}
                      </Text>
                      {membership.request_tier === "superlike" ? (
                        <Text style={styles.superlikeBadge}>Superlike</Text>
                      ) : null}
                      {membership.request_message ? (
                        <Text style={styles.detailValue}>{membership.request_message}</Text>
                      ) : null}
                      <View style={styles.actionRow}>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => handleReject(membership.user_id)}
                        >
                          Decline
                        </Button>
                        <Button size="sm" onPress={() => handleApprove(membership.user_id)}>
                          Approve
                        </Button>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Group gallery</Text>
          {media.length === 0 ? (
            <Text style={styles.detailValue}>No media uploaded yet.</Text>
          ) : (
            <View style={styles.mediaGrid}>
              {media.map((item) => {
                const sourceUrl = toAbsoluteUrl(item.url);
                return (
                  <View key={item.id} style={styles.mediaCard}>
                    {item.media_type === "video" ? (
                      <Video
                        source={{ uri: sourceUrl || "" }}
                        style={styles.media}
                        useNativeControls
                        resizeMode="cover"
                      />
                    ) : (
                      <Image source={{ uri: sourceUrl || "" }} style={styles.media} />
                    )}
                    <View style={styles.mediaFooter}>
                      {item.is_cover ? <Text style={styles.coverBadge}>Cover</Text> : null}
                      {isCreator ? (
                        <Pressable onPress={() => handleDeleteMedia(item.id)}>
                          <Text style={styles.removeText}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {isCreator ? (
            <View style={styles.uploadSection}>
              {selectedMedia ? (
                <Text style={styles.detailValue}>
                  Selected: {selectedMedia.name || "media"}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Button variant="outline" size="sm" onPress={handlePickMedia}>
                  Pick media
                </Button>
                <Pressable
                  style={[styles.toggle, isCoverUpload ? styles.toggleActive : null]}
                  onPress={() => setIsCoverUpload((prev) => !prev)}
                >
                  <Text
                    style={[styles.toggleText, isCoverUpload ? styles.toggleTextActive : null]}
                  >
                    Set as cover
                  </Text>
                </Pressable>
              </View>
              <Button onPress={handleUploadMedia} disabled={isUploading || !selectedMedia}>
                {isUploading ? "Uploading..." : "Upload media"}
              </Button>
            </View>
          ) : (
            <Text style={styles.detailValue}>Only the group admin can upload media.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Availability</Text>
          {!isMember ? (
            <Text style={styles.detailValue}>Join to see availability planning.</Text>
          ) : (
            <View style={styles.availabilityGrid}>
              {DAYS.map((day, dayIndex) => (
                <View key={day} style={styles.availabilityRow}>
                  <Text style={styles.availabilityDay}>{day}</Text>
                  <View style={styles.availabilitySlots}>
                    {AVAILABILITY_SLOTS.map((slot) => {
                      const key = `${dayIndex}|${slot}`;
                      const selected = availabilitySelection[key];
                      return (
                        <Pressable
                          key={key}
                          style={[styles.slotChip, selected ? styles.slotChipActive : null]}
                          onPress={() => handleToggleSlot(dayIndex, slot)}
                        >
                          <Text style={[styles.slotText, selected ? styles.slotTextActive : null]}>
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Button onPress={handleSaveAvailability} disabled={isSavingAvailability}>
                {isSavingAvailability ? "Saving..." : "Save availability"}
              </Button>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          {!isMember ? (
            <Text style={styles.detailValue}>Join to see announcements.</Text>
          ) : announcements.length === 0 ? (
            <Text style={styles.detailValue}>No announcements yet.</Text>
          ) : (
            <View style={styles.listStack}>
              {announcements.map((announcement) => (
                <View key={announcement.id} style={styles.announcementCard}>
                  <Text style={styles.planTitle}>{announcement.title}</Text>
                  {announcement.body ? (
                    <Text style={styles.detailValue}>{announcement.body}</Text>
                  ) : null}
                  <Text style={styles.helperText}>
                    {formatDateTime(announcement.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {isCreator ? (
            <View style={styles.formSection}>
              <Text style={styles.sectionSubtitle}>New announcement</Text>
              <TextInput
                value={announcementTitle}
                onChangeText={setAnnouncementTitle}
                placeholder="Announcement title"
                style={styles.input}
              />
              <TextInput
                value={announcementBody}
                onChangeText={setAnnouncementBody}
                placeholder="Details (optional)"
                style={[styles.input, styles.multiline]}
                multiline
              />
              <Button onPress={handleCreateAnnouncement} disabled={isCreatingAnnouncement}>
                {isCreatingAnnouncement ? "Posting..." : "Post announcement"}
              </Button>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plans</Text>
          {!isMember ? (
            <Text style={styles.detailValue}>Join to see and create plans.</Text>
          ) : plans.length === 0 ? (
            <Text style={styles.detailValue}>No plans yet.</Text>
          ) : (
            <View style={styles.listStack}>
              {plans.map((plan) => (
                <View key={plan.id} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    {plan.pinned ? <Text style={styles.coverBadge}>Pinned</Text> : null}
                  </View>
                  {plan.details ? <Text style={styles.detailValue}>{plan.details}</Text> : null}
                  <Text style={styles.detailValue}>
                    {plan.scheduled_at ? formatDateTime(plan.scheduled_at) : "Time not set"}
                  </Text>
                  {plan.location_name ? (
                    <Text style={styles.detailValue}>{plan.location_name}</Text>
                  ) : null}
                  {plan.location_lat != null && plan.location_lng != null ? (
                    <Pressable onPress={() => handleOpenMap(plan.location_lat, plan.location_lng)}>
                      <Text style={styles.link}>Open map</Text>
                    </Pressable>
                  ) : null}
                  {isMember ? (
                    <View style={styles.rsvpRow}>
                      <Text style={styles.detailValue}>
                        Going {planRsvps[plan.id]?.going ?? 0}
                      </Text>
                      <Text style={styles.detailValue}>
                        Interested {planRsvps[plan.id]?.interested ?? 0}
                      </Text>
                      <Text style={styles.detailValue}>
                        Not going {planRsvps[plan.id]?.not_going ?? 0}
                      </Text>
                    </View>
                  ) : null}
                  {isCreator && !plan.pinned ? (
                    <Button variant="outline" size="sm" onPress={() => handlePinPlan(plan.id)}>
                      Pin plan
                    </Button>
                  ) : null}
                  {isCreator ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => handleSendReminder(plan.id)}
                    >
                      Send reminder
                    </Button>
                  ) : null}
                  {isMember ? (
                    <View style={styles.rsvpActions}>
                      <Button
                        size="sm"
                        variant={
                          planRsvps[plan.id]?.user_status === "going" ? "default" : "outline"
                        }
                        onPress={() => handleRsvpPlan(plan.id, "going")}
                        disabled={rsvpLoading[plan.id]}
                      >
                        Going
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          planRsvps[plan.id]?.user_status === "interested" ? "default" : "outline"
                        }
                        onPress={() => handleRsvpPlan(plan.id, "interested")}
                        disabled={rsvpLoading[plan.id]}
                      >
                        Interested
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          planRsvps[plan.id]?.user_status === "not_going" ? "default" : "outline"
                        }
                        onPress={() => handleRsvpPlan(plan.id, "not_going")}
                        disabled={rsvpLoading[plan.id]}
                      >
                        Not going
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => handleSharePlan(plan)}>
                        Share
                      </Button>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {isMember ? (
            <View style={styles.formSection}>
              <Text style={styles.sectionSubtitle}>Create a plan</Text>
              <TextInput
                value={planTitle}
                onChangeText={setPlanTitle}
                placeholder="Plan title"
                style={styles.input}
              />
              <TextInput
                value={planDetails}
                onChangeText={setPlanDetails}
                placeholder="Details"
                style={[styles.input, styles.multiline]}
                multiline
              />
              <TextInput
                value={planDate}
                onChangeText={setPlanDate}
                placeholder="Date and time (YYYY-MM-DD HH:MM)"
                style={styles.input}
              />
              <TextInput
                value={planLocation}
                onChangeText={setPlanLocation}
                placeholder="Location name"
                style={styles.input}
              />
              <Pressable
                style={[styles.toggle, planPinned ? styles.toggleActive : null]}
                onPress={() => setPlanPinned((prev) => !prev)}
              >
                <Text style={[styles.toggleText, planPinned ? styles.toggleTextActive : null]}>
                  Pin this plan
                </Text>
              </Pressable>
              <Button onPress={handleCreatePlan} disabled={isCreatingPlan}>
                {isCreatingPlan ? "Creating..." : "Add plan"}
              </Button>
            </View>
          ) : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Polls</Text>
          {!isMember ? (
            <Text style={styles.detailValue}>Join to see polls.</Text>
          ) : polls.length === 0 ? (
            <Text style={styles.detailValue}>No polls yet.</Text>
          ) : (
            <View style={styles.listStack}>
              {polls.map((poll) => {
                const selections = pollSelections[poll.id] || [];
                return (
                  <View key={poll.id} style={styles.pollCard}>
                    <Text style={styles.planTitle}>{poll.question}</Text>
                    {poll.closes_at ? (
                      <Text style={styles.detailValue}>
                        Closes {formatDateTime(poll.closes_at)}
                      </Text>
                    ) : null}
                    {!poll.is_active ? <Text style={styles.status}>Poll closed</Text> : null}
                    <View style={styles.listStack}>
                      {poll.options.map((option) => {
                        const selected = selections.includes(option.id);
                        return (
                          <Pressable
                            key={option.id}
                            style={[styles.optionRow, selected ? styles.optionRowActive : null]}
                            onPress={() =>
                              togglePollSelection(poll.id, option.id, poll.is_multi)
                            }
                          >
                            <Text style={styles.optionLabel}>{option.label}</Text>
                            <Text style={styles.optionCount}>{option.vote_count || 0} votes</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.actionRow}>
                      <Button
                        size="sm"
                        onPress={() => handleVotePoll(poll.id)}
                        disabled={!poll.is_active || pollVoteLoading[poll.id]}
                      >
                        {pollVoteLoading[poll.id] ? "Voting..." : "Vote"}
                      </Button>
                      {isCreator && poll.is_active ? (
                        <Button size="sm" variant="outline" onPress={() => handleClosePoll(poll.id)}>
                          Close
                        </Button>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {isMember ? (
            <View style={styles.formSection}>
              <Text style={styles.sectionSubtitle}>Create a poll</Text>
              <TextInput
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="Poll question"
                style={styles.input}
              />
              <TextInput
                value={pollOptionsText}
                onChangeText={setPollOptionsText}
                placeholder="Options separated by commas"
                style={styles.input}
              />
              <TextInput
                value={pollClosesAt}
                onChangeText={setPollClosesAt}
                placeholder="Close date (YYYY-MM-DD HH:MM)"
                style={styles.input}
              />
              <Pressable
                style={[styles.toggle, pollMulti ? styles.toggleActive : null]}
                onPress={() => setPollMulti((prev) => !prev)}
              >
                <Text style={[styles.toggleText, pollMulti ? styles.toggleTextActive : null]}>
                  Allow multiple choices
                </Text>
              </Pressable>
              <Button onPress={handleCreatePoll} disabled={isCreatingPoll}>
                {isCreatingPoll ? "Creating..." : "Add poll"}
              </Button>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pins</Text>
          {!isMember ? (
            <Text style={styles.detailValue}>Join to add shared pins.</Text>
          ) : pins.length === 0 ? (
            <Text style={styles.detailValue}>No pins yet.</Text>
          ) : (
            <View style={styles.listStack}>
              {pins.map((pin) => (
                <View key={pin.id} style={styles.pinCard}>
                  <Text style={styles.planTitle}>{pin.title}</Text>
                  {pin.description ? <Text style={styles.detailValue}>{pin.description}</Text> : null}
                  {pin.lat != null && pin.lng != null ? (
                    <Pressable onPress={() => handleOpenMap(pin.lat, pin.lng)}>
                      <Text style={styles.link}>Open map</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {isMember ? (
            <View style={styles.formSection}>
              <Text style={styles.sectionSubtitle}>Add a pin</Text>
              <TextInput
                value={pinTitle}
                onChangeText={setPinTitle}
                placeholder="Pin title"
                style={styles.input}
              />
              <TextInput
                value={pinDescription}
                onChangeText={setPinDescription}
                placeholder="Description"
                style={[styles.input, styles.multiline]}
                multiline
              />
              <View style={styles.row}>
                <TextInput
                  value={pinLat}
                  onChangeText={setPinLat}
                  placeholder="Latitude"
                  style={[styles.input, styles.flex]}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  value={pinLng}
                  onChangeText={setPinLng}
                  placeholder="Longitude"
                  style={[styles.input, styles.flex]}
                  keyboardType="decimal-pad"
                />
              </View>
              <Button onPress={handleCreatePin} disabled={isCreatingPin}>
                {isCreatingPin ? "Creating..." : "Add pin"}
              </Button>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Group chat</Text>
          {isMember ? (
            <Button onPress={() => router.push(`/chat/${group.id}`)}>Open chat</Button>
          ) : (
            <Text style={styles.detailValue}>Join to access the group chat.</Text>
          )}
        </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 16,
    gap: 16,
  },
  containerWithNav: {
    paddingBottom: BOTTOM_NAV_HEIGHT + 16,
  },
  page: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: {
    gap: 12,
  },
  cover: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  coverPlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  headerText: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    fontSize: 12,
    color: "#475569",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  detailValue: {
    fontSize: 13,
    color: "#1e293b",
  },
  helperText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  detailBlock: {
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  chipMuted: {
    backgroundColor: "#e2e8f0",
    color: "#475569",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#e2e8f0",
  },
  creatorBody: {
    flex: 1,
    gap: 4,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  creatorMeta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  link: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
  },
  lockRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  toggleActive: {
    backgroundColor: "#1e293b",
    borderColor: "#1e293b",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  requirementCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  requirementTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  consentList: {
    gap: 4,
  },
  consentItem: {
    fontSize: 12,
    color: "#475569",
  },
  centeredRow: {
    gap: 10,
  },
  joinSection: {
    gap: 12,
  },
  consentToggleList: {
    gap: 8,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  checkboxRowActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#94a3b8",
    backgroundColor: "#ffffff",
  },
  checkboxActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkboxLabel: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "600",
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  memberCard: {
    width: "48%",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 6,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e2e8f0",
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e2e8f0",
  },
  memberName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  removeText: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  requestSection: {
    gap: 8,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  requestTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  superlikeBadge: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mediaCard: {
    width: "48%",
    gap: 6,
  },
  media: {
    width: "100%",
    height: 140,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
  },
  mediaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1e293b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  uploadSection: {
    gap: 10,
  },
  availabilityGrid: {
    gap: 12,
  },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  availabilityDay: {
    width: 50,
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  availabilitySlots: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  slotChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  slotChipActive: {
    backgroundColor: "#1e293b",
    borderColor: "#1e293b",
  },
  slotText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  slotTextActive: {
    color: "#ffffff",
  },
  listStack: {
    gap: 10,
  },
  icebreakerRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  planCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  announcementCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 6,
    backgroundColor: "#f8fafc",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  formSection: {
    gap: 10,
  },
  rsvpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rsvpActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#ffffff",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  pollCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  optionLabel: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "600",
  },
  optionCount: {
    fontSize: 12,
    color: "#64748b",
  },
  pinCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  status: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
  },
});
