import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { 
  Send, 
  Plus, 
  Search, 
  Phone, 
  Video, 
  Paperclip, 
  MessageSquare,
  Users,
  Mail,
  Smartphone,
  Clock,
  CheckCheck,
  CheckCircle,
  XCircle,
  RefreshCw,
  Star,
  Archive,
  Trash2,
  Edit,
  Copy,
  ArrowLeft,
  MoreVertical,
  Forward,
  Tag,
  X,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { useLocation } from "wouter";
import { isDoctorLike, formatRoleLabel } from "@/lib/role-utils";
import { Header } from "@/components/layout/header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getActiveSubdomain } from "@/lib/subdomain-utils";
import { createRemoteLiveKitRoom } from "@/lib/livekit-room-service";
import { buildSocketUserIdentifier } from "@/lib/socket-manager";
import { LiveKitVideoCall } from "@/components/telemedicine/livekit-video-call";
import { LiveKitAudioCall } from "@/components/telemedicine/livekit-audio-call";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'internal' | 'patient' | 'broadcast';
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
  }>;
  isStarred: boolean;
  threadId?: string;
}

interface Conversation {
  id: string;
  participants: Array<{
    id: string | number;
    name: string;
    role: string;
    avatar?: string;
  }>;
  lastMessage: Message;
  unreadCount: number;
  isPatientConversation: boolean;
}

// Campaign name suggestions organized by category
const CAMPAIGN_NAME_SUGGESTIONS = {
  "A. Patient-Focused Campaigns": [
    "Appointment reminders", "Follow-up reminders", "Missed appointment recalls", "Medication reminders",
    "Vaccination campaigns", "Preventive screening campaigns", "Chronic disease management campaigns",
    "Hospital service announcements", "Health education campaigns", "Patient satisfaction surveys",
    "Discharge follow-up campaigns", "Health camp invitations", "Insurance renewal reminders", "Billing & payment reminders"
  ],
  "B. Staff-Focused Campaigns": [
    "Staff training campaigns", "Policy updates", "Shift schedule notifications", "Internal event announcements",
    "Staff wellness campaigns", "Emergency drills", "Performance review campaigns", "New equipment training"
  ],
  "C. Doctor-Specific Campaigns": [
    "Clinical guideline updates", "New protocol announcements", "CME invitations",
    "Specialist rotation schedules", "Case discussion reminders"
  ],
  "D. Public / Community Campaigns": [
    "Blood donation drives", "Organ donation awareness", "Public health awareness",
    "Free medical camps", "Community vaccination drives", "Disaster response communication"
  ],
  "E. IT & System Campaigns": [
    "IT system maintenance", "App/portal updates", "Password reset reminders", "Cybersecurity updates"
  ],
  "F. Emergency & Safety Campaigns": [
    "Emergency preparedness", "Disaster management alerts", "Fire & safety equipment checks",
    "Ambulance readiness updates", "Outbreak/epidemic alerts"
  ],
  "G. Quality & Compliance Campaigns": [
    "Accreditation readiness", "Quality audits", "Clinical compliance updates", "Feedback & incident reporting"
  ],
  "H. Financial & Administrative Campaigns": [
    "Insurance documentation reminders", "Corporate client campaigns", "Tariff updates",
    "Staff payroll communication", "Vendor communication", "Contractor compliance updates"
  ],
  "I. Facility & Maintenance Campaigns": [
    "Maintenance alerts", "Water/electricity outage alerts", "Elevator servicing",
    "Biomedical waste reminders", "Renovation updates"
  ],
  "J. HR & Workforce Campaigns": [
    "Employee onboarding", "Leave policy updates", "Recruitment/interview updates",
    "Attendance reminders", "Grievance communication"
  ],
  "K. Patient Experience & Engagement": [
    "Patient onboarding instructions", "Inpatient daily schedule", "Patient portal activation",
    "Patient education videos", "Dietary instruction campaigns"
  ],
  "L. Pharmacy Campaigns": [
    "Drug availability alerts", "Medication shortage alerts", "New drug announcements",
    "Pharmacy recall alerts", "Prescription renewal reminders"
  ],
  "M. Laboratory & Radiology Campaigns": [
    "Lab report ready alerts", "Sample recollection alerts", "New diagnostic test updates", "Equipment downtime notifications"
  ],
  "N. IT & Digital Campaigns": [
    "System downtime alerts", "Software feature updates", "Cybersecurity awareness",
    "Telemedicine activation", "Mobile app promotions"
  ],
  "O. Hospitality & Guest Services": [
    "Canteen menu updates", "Visitor guidelines", "Parking updates", "Room sanitization reminders"
  ],
  "P. Specialty Department Campaigns": [
    "Maternity program campaigns", "Pediatrics vaccination reminders", "Cardiology heart health programs",
    "Orthopedic rehab campaigns", "Mental health awareness"
  ],
  "Q. Volunteer & CSR Campaigns": [
    "Charity event announcements", "CSR health projects", "Volunteer recruitment", "NGO partnership updates"
  ],
  "R. VIP / Corporate Patient Campaigns": [
    "Corporate health check campaigns", "VIP patient communication", "Employee wellness tie-ups"
  ],
  "S. Operations & Workflow Campaigns": [
    "OT schedule updates", "Bed availability notifications", "Ward occupancy alerts",
    "Queue management updates", "Transport/porter requests", "Cleaning & housekeeping rotation", "Sterilization cycle alerts"
  ],
  "T. Nursing Department Campaigns": [
    "Nursing duty roster updates", "Nursing documentation compliance", "Bedside care protocols",
    "Nursing audits", "Patient fall risk communication"
  ],
  "U. Security & Access Control Campaigns": [
    "ID card renewal", "Visitor access policy updates", "Security drill reminders",
    "Lost & found communication", "Restricted area alerts"
  ],
  "V. Medical Records / HIS Campaigns": [
    "MRD file submission reminders", "Digitization project updates", "Data correction requests", "Discharge summary completion"
  ],
  "W. Customer Service / Helpdesk Campaigns": [
    "Complaint resolution notifications", "Helpline updates", "New service announcements", "Token system alerts"
  ],
  "X. Ambulance & Emergency Department": [
    "Emergency team activation", "Trauma protocol updates", "Ambulance dispatch coordination",
    "Triage training", "Surge capacity alerts"
  ],
  "Y. Specialty Clinical Departments": [
    "Oncology follow-ups", "Dialysis schedule reminders", "Transplant coordination alerts",
    "Rehabilitation therapy reminders", "Pain management program campaigns"
  ],
  "Z. Infection Control Campaigns": [
    "Hand hygiene audits", "Isolation precautions", "Post-exposure prophylaxis alerts",
    "Antibiotic stewardship", "Air/surface testing alerts"
  ]
};

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'both';
  status: 'draft' | 'scheduled' | 'sent' | 'paused';
  subject: string;
  content: string;
  recipientCount: number;
  sentCount: number;
  openRate: number;
  clickRate: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  template: string;
}

export default function MessagingPage() {
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const [, setLocation] = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  
  const [liveKitVideoCall, setLiveKitVideoCall] = useState<{
    roomName: string;
    participant: any;
    token?: string;
    serverUrl?: string;
  } | null>(null);
  const [liveKitAudioCall, setLiveKitAudioCall] = useState<{
    roomName: string;
    participant: any;
    token?: string;
    serverUrl?: string;
  } | null>(null);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState("all");
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campaignNamePopoverOpen, setCampaignNamePopoverOpen] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [activeVideoCall, setActiveVideoCall] = useState(false);
  const [callParticipant, setCallParticipant] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [meetingInfo, setMeetingInfo] = useState<{meetingID: string, moderatorPassword: string} | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    type: "email" as "email" | "sms" | "both",
    subject: "",
    content: "",
    template: "default",
    recipients: [] as Array<{id: number, name: string, role: string, phone: string, email: string}>,
    sendMode: "now" as "now" | "schedule",
    scheduledDateTime: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [campaignRecipientRole, setCampaignRecipientRole] = useState("");
  const [campaignRecipientName, setCampaignRecipientName] = useState("");
  const [campaignRecipientPhone, setCampaignRecipientPhone] = useState("");
  const [showCampaignSummary, setShowCampaignSummary] = useState(false);
  const [campaignSummary, setCampaignSummary] = useState<{
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
    deliveryLog: Array<{recipient: string; phone: string; status: string; messageId?: string; error?: string}>;
  } | null>(null);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [showSendingProgress, setShowSendingProgress] = useState(false);
  const [sendingRecipients, setSendingRecipients] = useState<Array<{
    id: number;
    name: string;
    phone: string;
    status: 'pending' | 'sending' | 'sent' | 'failed';
    error?: string;
  }>>([]);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "general" as "general" | "medical" | "preventive" | "urgent" | "onboarding",
    subject: "",
    content: ""
  });
  const [showUseTemplate, setShowUseTemplate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState({
    name: "",
    category: "general" as "general" | "medical" | "preventive" | "urgent" | "onboarding",
    subject: "",
    content: ""
  });
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [editingCampaign, setEditingCampaign] = useState({
    name: "",
    type: "email" as "email" | "sms" | "both",
    subject: "",
    content: "",
    template: "default",
    status: "draft" as "draft" | "scheduled" | "sent" | "paused",
    scheduledAt: "",
    recipientCount: 0,
    recipients: [] as Array<{id: number, name: string, role: string, phone: string, email: string}>
  });
  const [editCampaignRecipientRole, setEditCampaignRecipientRole] = useState("");
  const [editCampaignRecipientName, setEditCampaignRecipientName] = useState("");
  const [editCampaignRecipientPhone, setEditCampaignRecipientPhone] = useState("");
  const [showViewCampaign, setShowViewCampaign] = useState(false);
  const [viewingCampaign, setViewingCampaign] = useState<any>(null);
  const [showViewCampaignRecipients, setShowViewCampaignRecipients] = useState(false);
  const [campaignSubTab, setCampaignSubTab] = useState<"all" | "history" | "email_history">("all");
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [recipientFilter, setRecipientFilter] = useState({
    role: "all",
    searchName: ""
  });
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);
  const [showDeleteCampaign, setShowDeleteCampaign] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null);
  const [showDeleteTemplate, setShowDeleteTemplate] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [showCallInProgress, setShowCallInProgress] = useState(false);
  const [callInProgressParticipant, setCallInProgressParticipant] = useState<string>("");
  const [newMessage, setNewMessage] = useState({
    recipient: "",
    subject: "",
    content: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    type: "internal" as "internal" | "patient" | "broadcast",
    phoneNumber: "",
    messageType: "sms" as "sms" | "whatsapp" | "email" | "voice"
  });
  const [videoCall, setVideoCall] = useState({
    participant: "",
    type: "consultation" as "consultation" | "team_meeting" | "emergency",
    duration: "30" as "15" | "30" | "60" | "90",
    scheduled: false,
    scheduledTime: ""
  });
  const [selectedVideoCallPatient, setSelectedVideoCallPatient] = useState<string>("");
  const [videoCallPatientSearch, setVideoCallPatientSearch] = useState<string>("");
  const [selectedMessagePatient, setSelectedMessagePatient] = useState<string>("");
  const [messagePatientSearch, setMessagePatientSearch] = useState<string>("");
  const [selectedRecipientRole, setSelectedRecipientRole] = useState<string>("");
  const [selectedRecipientUser, setSelectedRecipientUser] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<{
    recipientRole?: string;
    recipientName?: string;
    subject?: string;
    phoneNumber?: string;
    content?: string;
  }>({});
  const { toast } = useToast();

  // Authentication token and headers
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    setAuthToken(token);
  }, []);

  // Fetch current user information
  const { data: user } = useQuery({
    queryKey: ['/api/auth/validate'],
    queryFn: async () => {
      console.log('🔐 FETCHING USER AUTH DATA for WebSocket connection');
      const response = await apiRequest('GET', '/api/auth/validate');
      const data = await response.json();
      console.log('🔐 USER AUTH DATA RECEIVED:', data.user);
      return data.user;
    }
  });

  // Check if user is a doctor role
  const isDoctor = isDoctorLike(user?.role);

  // Fetch patients for searchable dropdown
  const { data: patientsData, isLoading: patientsLoading, error: patientsError } = useQuery({
    queryKey: ['/api/patients'],
    queryFn: async () => {
      console.log('📋 MESSAGING: Fetching patients data...');
      const response = await apiRequest('GET', '/api/patients');
      const data = await response.json();
      console.log('📋 MESSAGING: Patients data received:', data?.length || 0, 'patients');
      return data;
    },
    enabled: true // Always fetch patients data
  });

  // Fetch users for admin and patient role-based filtering
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      const data = await response.json();
      return data;
    },
    enabled: user?.role === 'admin' || user?.role === 'patient' // Fetch when user is admin or patient
  });

  // Fetch roles from the roles table filtered by organization_id
  const { data: rolesData = [] } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/roles");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Roles fetch error:", error);
        return [];
      }
    },
  });

  // Update current user when user data changes
  useEffect(() => {
    if (user) {
      console.log('🔐 SETTING CURRENT USER for WebSocket:', user);
      setCurrentUser(user);
    } else {
      console.log('🔐 NO USER DATA - WebSocket cannot connect');
    }
  }, [user]);

  // Filter patients based on search
  const filteredVideoCallPatients = (patientsData || []).filter((patient: any) =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(videoCallPatientSearch.toLowerCase()) ||
    patient.email?.toLowerCase().includes(videoCallPatientSearch.toLowerCase()) ||
    patient.patientId?.toLowerCase().includes(videoCallPatientSearch.toLowerCase())
  );

  const filteredMessagePatients = (patientsData || []).filter((patient: any) =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(messagePatientSearch.toLowerCase()) ||
    patient.email?.toLowerCase().includes(messagePatientSearch.toLowerCase()) ||
    patient.patientId?.toLowerCase().includes(messagePatientSearch.toLowerCase())
  );

  // Filter users/patients based on selected role for admin
  const filteredRecipients = selectedRecipientRole === 'patient' 
    ? (patientsData || [])
    : selectedRecipientRole 
      ? (usersData || []).filter((u: any) => u.role === selectedRecipientRole)
      : [];

  // Helper function to get the other participant (not the current user)
  const getOtherParticipant = (conversation: Conversation) => {
    console.log('🔍 GET OTHER PARTICIPANT - Conversation:', conversation.id);
    console.log('🔍 PARTICIPANTS:', conversation.participants);
    console.log('🔍 CURRENT USER:', currentUser?.id);
    
    if (!currentUser) {
      // Return first participant with a valid name, or first participant
      const validParticipant = conversation.participants.find(p => p.name && p.name !== 'undefined' && p.id);
      console.log('🔍 NO CURRENT USER - Valid participant:', validParticipant);
      return validParticipant || conversation.participants[0];
    }
    
    // Find the participant that is NOT the current user (simple ID comparison)
    const otherParticipant = conversation.participants.find(p => 
      p.id && String(p.id) !== String(currentUser.id)
    );
    
    console.log('🔍 OTHER PARTICIPANT FOUND:', otherParticipant);
    return otherParticipant || conversation.participants[0];
  };

  // LiveKit call helpers
  const buildParticipantIdentifier = (entity: any, defaultRole = "participant") => {
    let firstName = entity?.firstName;
    let lastName = entity?.lastName;
    
    if (!firstName && !lastName && entity?.name) {
      const nameParts = entity.name.split(" ");
      firstName = nameParts[0] || entity.name;
      lastName = nameParts.slice(1).join(" ") || "";
    }
    
    return buildSocketUserIdentifier({
      id: entity?.id,
      firstName,
      lastName,
      email: entity?.email,
      role: entity?.role || defaultRole,
    });
  };

  const getDisplayName = (entity: any) => {
    const name = [entity?.firstName, entity?.lastName].filter(Boolean).join(" ").trim();
    return name || entity?.name || entity?.email || `user-${entity?.id}`;
  };

  const startLiveKitVideoCall = async (participant: any) => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start a video call",
          variant: "destructive",
        });
        return;
      }

      const fromIdentifier = buildParticipantIdentifier(user, user.role);
      const toIdentifier = buildParticipantIdentifier(participant, participant.role);

      if (!fromIdentifier || !toIdentifier) {
        toast({
          title: "Call Failed",
          description: "Unable to determine participant identifiers",
          variant: "destructive",
        });
        return;
      }

      const roomName = `messaging-video-${user.id}-${participant.id}-${Date.now()}`;

      toast({
        title: "Video Call Starting",
        description: `Connecting to video call with ${getDisplayName(participant)}`,
      });

      const liveKitRoom = await createRemoteLiveKitRoom({
        roomId: roomName,
        fromUsername: fromIdentifier,
        toUsers: [
          {
            identifier: toIdentifier,
            displayName: getDisplayName(participant),
          },
        ],
        isVideo: true,
        groupName: "Messaging Video Call",
      });

      const finalRoomId = liveKitRoom.roomId || roomName;

      setLiveKitVideoCall({
        roomName: finalRoomId,
        participant,
        token: liveKitRoom.token,
        serverUrl: liveKitRoom.serverUrl,
      });
    } catch (error: any) {
      console.error("LiveKit video call failed:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Unable to start video call",
        variant: "destructive",
      });
    }
  };

  const startLiveKitAudioCall = async (participant: any) => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start an audio call",
          variant: "destructive",
        });
        return;
      }

      const fromIdentifier = buildParticipantIdentifier(user, user.role);
      const toIdentifier = buildParticipantIdentifier(participant, participant.role);

      if (!fromIdentifier || !toIdentifier) {
        toast({
          title: "Call Failed",
          description: "Unable to determine participant identifiers",
          variant: "destructive",
        });
        return;
      }

      const roomName = `messaging-audio-${user.id}-${participant.id}-${Date.now()}`;

      toast({
        title: "Audio Call Starting",
        description: `Connecting to audio call with ${getDisplayName(participant)}`,
      });

      const liveKitRoom = await createRemoteLiveKitRoom({
        roomId: roomName,
        fromUsername: fromIdentifier,
        toUsers: [
          {
            identifier: toIdentifier,
            displayName: getDisplayName(participant),
          },
        ],
        isVideo: false,
        groupName: "Messaging Audio Call",
      });

      const finalRoomId = liveKitRoom.roomId || roomName;

      setLiveKitAudioCall({
        roomName: finalRoomId,
        participant,
        token: liveKitRoom.token,
        serverUrl: liveKitRoom.serverUrl,
      });
    } catch (error: any) {
      console.error("LiveKit audio call failed:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Unable to start audio call",
        variant: "destructive",
      });
    }
  };

  const handleLiveKitVideoCallEnd = () => {
    setLiveKitVideoCall(null);
    toast({
      title: "Call Ended",
      description: "Video call has been terminated",
    });
  };

  const handleLiveKitAudioCallEnd = () => {
    setLiveKitAudioCall(null);
    toast({
      title: "Call Ended",
      description: "Audio call has been terminated",
    });
  };

  // Clear message content when conversation changes
  useEffect(() => {
    setNewMessageContent("");
  }, [selectedConversation]);

  const { data: conversations = [], isLoading: conversationsLoading, error: conversationsError, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/messaging/conversations'],
    enabled: true, // Enable automatic execution to load conversations
    staleTime: 300000, // Consider data fresh for 5 minutes
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Don't auto-refetch on mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: false, // Don't poll
    retry: 1, // Only retry once on failure
    queryFn: async () => {
      console.log('🔄 FETCHING CONVERSATIONS');
      const response = await apiRequest('GET', '/api/messaging/conversations');
      const data = await response.json();
      console.log('📨 CONVERSATIONS DATA RECEIVED:', JSON.stringify(data, null, 2));
      return data;
    }
  });

  // Auto-select first conversation when conversations load
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      console.log('🔥 AUTO-SELECTING FIRST CONVERSATION:', conversations[0].id);
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation]);

  // Bypass React Query completely for messages to avoid cache issues
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    
    setMessagesLoading(true);
    try {
      console.log('🔥 DIRECT FETCH MESSAGES for conversation:', conversationId);
      console.log('🔥 FETCH TIMESTAMP:', new Date().toISOString());
      const response = await apiRequest('GET', `/api/messaging/messages/${conversationId}`);
      const data = await response.json();
      console.log('🔥 DIRECT FETCH COMPLETED:', data.length, 'messages');
      console.log('🔥 MESSAGE IDS:', data.map((m: any) => m.id));
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);
  
  // Fetch messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, fetchMessages]);

  const { data: campaigns = [], isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ['/api/messaging/campaigns'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      console.log('Fetching campaigns with token:', token ? 'present' : 'missing');
      const response = await fetch('/api/messaging/campaigns', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      console.log('Campaigns response status:', response.status);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      const data = await response.json();
      console.log('Campaigns data received:', data);
      return data;
    }
  });

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ['/api/messaging/templates'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      console.log('Fetching templates with token:', token ? 'present' : 'missing');
      const response = await fetch('/api/messaging/templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      console.log('Templates response status:', response.status);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      const data = await response.json();
      console.log('Templates data received:', data);
      return data;
    }
  });

  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/messaging/analytics'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/analytics', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    }
  });

  const { data: smsMessages = [], isLoading: smsLoading, refetch: refetchSmsMessages } = useQuery({
    queryKey: ['/api/messaging/sms-messages'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/sms-messages', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    }
  });

  const resetNewMessage = () => {
    setNewMessage({
      recipient: "",
      subject: "",
      content: "",
      priority: "normal",
      type: "internal",
      phoneNumber: "",
      messageType: "email"
    });
    setValidationErrors({});
    setSelectedRecipientRole("");
    setSelectedRecipientUser("");
    setSelectedMessagePatient("");
  };



  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(messageData),
      });
      
      if (!response.ok) {
        // Parse error response for SMS/WhatsApp delivery failures
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      console.log('🎯 MESSAGE SENT SUCCESS - updating conversations cache immediately');
      
      // Force immediate UI update for conversations list
      const currentConversations = queryClient.getQueryData(['/api/messaging/conversations']) as any[] || [];
      
      // Check if this creates a new conversation or updates existing
      const existingConversation = currentConversations.find(conv => conv.id === data.conversationId);
      
      if (!existingConversation) {
        // New conversation created - force complete cache refresh
        console.log('🔄 NEW CONVERSATION DETECTED - forcing complete refresh');
        queryClient.removeQueries({ queryKey: ['/api/messaging/conversations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
        // Force immediate refetch
        // setTimeout(() => {
        //   refetchConversations();
        // }, 100);
      } else {
        // Existing conversation - update the last message info immediately
        const updatedConversations = currentConversations.map(conv => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              lastMessage: {
                id: data.id,
                content: data.content,
                subject: data.subject || "",
                priority: data.priority || "normal",
                timestamp: data.timestamp || new Date().toISOString(),
                senderId: data.senderId
              },
              updatedAt: new Date().toISOString()
            };
          }
          return conv;
        });
        
        // Update the cache immediately
        queryClient.setQueryData(['/api/messaging/conversations'], updatedConversations);
        
        // Force invalidation and refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
        // setTimeout(() => {
        //   console.log('🔄 EXISTING CONVERSATION UPDATED - forcing refetch');
        //   refetchConversations();
        // }, 50);
      }
      
      // Invalidate SMS messages query if an SMS was sent
      if (variables.messageType === 'sms') {
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/sms-messages'] });
      }
      
      // Only handle new message dialog closing here
      if (!variables.conversationId) {
        // It's a new message, so close the dialog and reset the form
        setShowNewMessage(false);
        resetNewMessage();
        
        // Show different success message based on communication method
        let title = "Message Sent";
        let description = "Your message has been sent successfully.";
        
        if (variables.messageType === 'email') {
          title = "Email Sent Successfully";
          description = `Your email has been delivered successfully to the recipient.`;
        } else if (variables.messageType === 'sms') {
          title = "SMS Sent Successfully";
          description = `SMS delivered successfully to ${variables.phoneNumber} via Twilio. Check the SMS tab to see your message.`;
        } else if (variables.messageType === 'whatsapp') {
          title = "WhatsApp Sent Successfully";
          description = `WhatsApp message delivered successfully to ${variables.phoneNumber}.`;
        } else if (variables.messageType === 'voice') {
          title = "Voice Call Initiated";
          description = `Voice call with text-to-speech message initiated successfully to ${variables.phoneNumber || 'recipient'}.`;
        }
        
        toast({
          title: title,
          description: description,
        });
      }
      // Conversation message success is handled in handleSendConversationMessage
    },
    onError: (error: any) => {
      console.error('Message sending failed:', error);
      toast({
        title: "Message Failed",
        description: error.message || "Failed to send message. Please check your configuration and try again.",
        variant: "destructive"
      });
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onMutate: async (conversationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/messaging/conversations'] });

      // Snapshot the previous value
      const previousConversations = queryClient.getQueryData(['/api/messaging/conversations']);

      // Optimistically update to remove the conversation
      const currentConversations = (previousConversations as any[]) || [];
      const updatedConversations = currentConversations.filter(conv => conv.id !== conversationId);
      queryClient.setQueryData(['/api/messaging/conversations'], updatedConversations);

      // If we're currently viewing this conversation, go back to conversations list
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
      }

      return { previousConversations };
    },
    onSuccess: (data, conversationId) => {
      console.log('🗑️ CONVERSATION DELETED SUCCESS:', conversationId);
      
      toast({
        title: "Conversation Deleted",
        description: "The conversation has been permanently deleted.",
      });
    },
    onError: (err, conversationId, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(['/api/messaging/conversations'], context.previousConversations);
      }
      
      console.error('Conversation deletion failed:', err);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete conversation. Please try again.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch after mutation settles - force complete refresh
      queryClient.removeQueries({ queryKey: ['/api/messaging/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      // setTimeout(() => {
      //   refetchConversations();
      // }, 50);
    }
  });

  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/update-delivery-status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('🔄 DELIVERY STATUS UPDATE SUCCESS:', data);
      
      // Refresh messages and conversations to show updated delivery statuses
      if (selectedConversation) {
        fetchMessages(selectedConversation);
      }
      // refetchConversations();
      
      toast({
        title: "Delivery Status Updated",
        description: `Updated delivery status for ${data.updatedCount || 0} pending messages.`,
      });
    },
    onError: (error: any) => {
      console.error('Delivery status update failed:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update delivery status. Please try again.",
        variant: "destructive"
      });
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/campaigns', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(campaignData),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/sms-messages'] });
    }
  });

  const resetCampaignForm = () => {
    setNewCampaign({
      name: "",
      type: "email",
      subject: "",
      content: "",
      template: "default",
      recipients: [],
      sendMode: "now",
      scheduledDateTime: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    setCampaignRecipientRole("");
    setCampaignRecipientName("");
    setCampaignRecipientPhone("");
  };

  const personalizeMessage = (content: string, recipient: {name: string}) => {
    const nameParts = recipient.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    return content
      .replace(/\[FirstName\]/gi, firstName)
      .replace(/\[LastName\]/gi, lastName);
  };

  const handleSendCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in campaign name and content.",
        variant: "destructive"
      });
      return;
    }

    if ((newCampaign.type === 'sms' || newCampaign.type === 'both') && newCampaign.recipients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one recipient for SMS campaign.",
        variant: "destructive"
      });
      return;
    }

    if (newCampaign.sendMode === 'schedule' && !newCampaign.scheduledDateTime) {
      toast({
        title: "Validation Error",
        description: "Please select a scheduled date and time.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingCampaign(true);
    const deliveryLog: Array<{recipient: string; phone: string; status: string; messageId?: string; error?: string}> = [];
    let totalSent = 0;
    let totalFailed = 0;

    try {
      const token = localStorage.getItem('auth_token');
      
      // Send SMS to each recipient
      if (newCampaign.type === 'sms' || newCampaign.type === 'both') {
        for (const recipient of newCampaign.recipients) {
          if (!recipient.phone) {
            deliveryLog.push({
              recipient: recipient.name,
              phone: recipient.phone || 'N/A',
              status: 'failed',
              error: 'No phone number'
            });
            totalFailed++;
            continue;
          }

          try {
            const personalizedContent = personalizeMessage(newCampaign.content, recipient);
            
            const response = await fetch('/api/messaging/send', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({
                recipientName: recipient.name,
                recipientId: recipient.id,
                subject: newCampaign.subject,
                content: personalizedContent,
                priority: 'normal',
                type: 'patient',
                messageType: 'sms',
                phoneNumber: recipient.phone,
                campaignId: newCampaign.name
              }),
            });

            if (response.ok) {
              const data = await response.json();
              deliveryLog.push({
                recipient: recipient.name,
                phone: recipient.phone,
                status: 'sent',
                messageId: data.message?.externalMessageId || data.twilioSid
              });
              totalSent++;
            } else {
              const errorData = await response.json().catch(() => ({}));
              deliveryLog.push({
                recipient: recipient.name,
                phone: recipient.phone,
                status: 'failed',
                error: errorData.error || 'Failed to send'
              });
              totalFailed++;
            }
          } catch (err: any) {
            deliveryLog.push({
              recipient: recipient.name,
              phone: recipient.phone,
              status: 'failed',
              error: err.message || 'Network error'
            });
            totalFailed++;
          }
        }
      }

      // Create campaign record with recipients
      await createCampaignMutation.mutateAsync({
        name: newCampaign.name,
        type: newCampaign.type,
        subject: newCampaign.subject,
        content: newCampaign.content,
        template: newCampaign.template,
        status: newCampaign.sendMode === 'schedule' ? 'scheduled' : (totalSent > 0 ? 'sent' : 'draft'),
        recipientCount: newCampaign.recipients.length,
        sentCount: totalSent,
        openRate: 0,
        clickRate: 0,
        scheduledAt: newCampaign.sendMode === 'schedule' ? newCampaign.scheduledDateTime : null,
        timezone: newCampaign.timezone,
        recipients: newCampaign.recipients.map(r => ({
          id: r.id,
          name: r.name,
          role: r.role,
          phone: r.phone,
          email: r.email || ''
        }))
      });

      setCampaignSummary({
        totalRecipients: newCampaign.recipients.length,
        totalSent,
        totalFailed,
        deliveryLog
      });
      
      setShowCreateCampaign(false);
      setShowCampaignSummary(true);
      resetCampaignForm();

    } catch (error: any) {
      toast({
        title: "Campaign Error",
        description: error.message || "An error occurred while sending the campaign.",
        variant: "destructive"
      });
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.subject.trim() || !newCampaign.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (newCampaign.recipients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one recipient.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createCampaignMutation.mutateAsync({
        ...newCampaign,
        status: newCampaign.sendMode === 'schedule' ? 'scheduled' : 'draft',
        recipientCount: newCampaign.recipients.length,
        sentCount: 0,
        openRate: 0,
        clickRate: 0,
        scheduledAt: newCampaign.sendMode === 'schedule' ? newCampaign.scheduledDateTime : null,
        timezone: newCampaign.timezone,
        recipients: newCampaign.recipients.map(r => ({
          id: r.id,
          name: r.name,
          role: r.role,
          phone: r.phone,
          email: r.email || ''
        }))
      });
      
      setShowCreateCampaign(false);
      resetCampaignForm();
      toast({
        title: "Campaign Created",
        description: newCampaign.sendMode === 'schedule' 
          ? "Your campaign has been scheduled successfully."
          : "Your campaign has been saved as draft. You can send it from the campaigns list.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign.",
        variant: "destructive"
      });
    }
  };

  const handleCreateCampaign = () => {
    handleSaveCampaign();
  };

  // Save and Send Campaign - saves to database then sends SMS one by one with progress
  const handleSaveAndSendCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.subject.trim() || !newCampaign.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (newCampaign.recipients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one recipient.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingCampaign(true);
    
    // Initialize sending recipients with pending status
    const initialRecipients = newCampaign.recipients.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      status: 'pending' as const
    }));
    setSendingRecipients(initialRecipients);
    setShowSendingProgress(true);

    try {
      // First create the campaign as draft
      const createdCampaign = await createCampaignMutation.mutateAsync({
        ...newCampaign,
        status: 'draft',
        recipientCount: newCampaign.recipients.length,
        sentCount: 0,
        openRate: 0,
        clickRate: 0,
        scheduledAt: null,
        timezone: newCampaign.timezone,
        recipients: newCampaign.recipients.map(r => ({
          id: r.id,
          name: r.name,
          role: r.role,
          phone: r.phone,
          email: r.email || ''
        }))
      });

      if (createdCampaign && createdCampaign.id) {
        let totalSent = 0;
        let totalFailed = 0;
        const deliveryLog: Array<{recipient: string; phone: string; status: string; error?: string}> = [];

        // Send SMS one by one
        for (let i = 0; i < newCampaign.recipients.length; i++) {
          const recipient = newCampaign.recipients[i];
          
          // Update status to sending
          setSendingRecipients(prev => prev.map((r, idx) => 
            idx === i ? { ...r, status: 'sending' as const } : r
          ));

          try {
            const response = await apiRequest('POST', `/api/messaging/campaigns/${createdCampaign.id}/send-single`, {
              recipient: {
                id: recipient.id,
                name: recipient.name,
                phone: recipient.phone,
                email: recipient.email
              },
              content: newCampaign.content,
              type: newCampaign.type,
              subject: newCampaign.subject
            });

            const result = await response.json();
            
            if (result.success) {
              totalSent++;
              deliveryLog.push({ recipient: recipient.name, phone: recipient.phone, status: 'sent' });
              setSendingRecipients(prev => prev.map((r, idx) => 
                idx === i ? { ...r, status: 'sent' as const } : r
              ));
            } else {
              totalFailed++;
              deliveryLog.push({ recipient: recipient.name, phone: recipient.phone, status: 'failed', error: result.error });
              setSendingRecipients(prev => prev.map((r, idx) => 
                idx === i ? { ...r, status: 'failed' as const, error: result.error } : r
              ));
            }
          } catch (err: any) {
            totalFailed++;
            deliveryLog.push({ recipient: recipient.name, phone: recipient.phone, status: 'failed', error: err.message });
            setSendingRecipients(prev => prev.map((r, idx) => 
              idx === i ? { ...r, status: 'failed' as const, error: err.message } : r
            ));
          }

          // Small delay between sends to avoid rate limiting
          if (i < newCampaign.recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Finalize the campaign status
        await apiRequest('POST', `/api/messaging/campaigns/${createdCampaign.id}/finalize-send`, {
          sentCount: totalSent
        });
        
        // Wait a moment so user can see the final status
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setShowSendingProgress(false);
        setShowCreateCampaign(false);
        resetCampaignForm();
        
        // Show campaign summary
        setCampaignSummary({
          totalRecipients: newCampaign.recipients.length,
          totalSent,
          totalFailed,
          deliveryLog
        });
        setShowCampaignSummary(true);
        
        toast({
          title: "Campaign Sent",
          description: `Campaign "${newCampaign.name}" has been sent to ${totalSent} recipient(s).`,
        });
        
        // Invalidate campaigns cache
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      }
    } catch (error: any) {
      setShowSendingProgress(false);
      toast({
        title: "Error",
        description: error.message || "Failed to save and send campaign.",
        variant: "destructive"
      });
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const addCampaignRecipient = () => {
    if (!campaignRecipientName) {
      toast({
        title: "Validation Error",
        description: "Please select a recipient name.",
        variant: "destructive"
      });
      return;
    }

    // Find the recipient in the filtered list
    const recipientsList = campaignRecipientRole === 'patient' 
      ? (patientsData || []) 
      : (usersData || []).filter((u: any) => u.role === campaignRecipientRole || !campaignRecipientRole);
    
    const recipient = recipientsList.find((r: any) => `${r.firstName} ${r.lastName}` === campaignRecipientName);
    
    if (!recipient) {
      toast({
        title: "Error",
        description: "Recipient not found.",
        variant: "destructive"
      });
      return;
    }

    // Check if already added
    if (newCampaign.recipients.some(r => r.id === recipient.id)) {
      toast({
        title: "Already Added",
        description: "This recipient is already in the list.",
        variant: "destructive"
      });
      return;
    }

    const phone = campaignRecipientPhone || recipient.phone || recipient.phoneNumber || recipient.mobile || '';
    const email = recipient.email || '';

    setNewCampaign(prev => ({
      ...prev,
      recipients: [...prev.recipients, {
        id: recipient.id,
        name: `${recipient.firstName} ${recipient.lastName}`,
        role: campaignRecipientRole,
        phone,
        email
      }]
    }));

    setCampaignRecipientName("");
    setCampaignRecipientPhone("");
  };

  const removeCampaignRecipient = (id: number) => {
    setNewCampaign(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r.id !== id)
    }));
  };

  const getCampaignFilteredRecipients = () => {
    if (!campaignRecipientRole) return [];
    if (campaignRecipientRole === 'patient') {
      return patientsData || [];
    }
    return (usersData || []).filter((u: any) => u.role === campaignRecipientRole);
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(templateData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/templates'] });
      setShowCreateTemplate(false);
      setNewTemplate({
        name: "",
        category: "general",
        subject: "",
        content: ""
      });
      toast({
        title: "Template Created",
        description: "Your message template has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating template:", error);
      toast({
        title: "Failed to Create Template",
        description: error.message || "An error occurred while creating the template. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    createTemplateMutation.mutate(newTemplate);
  };

  // Fetch all users for Use Template dialog
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: showUseTemplate,
  });

  // Fetch roles for filter
  const { data: allRoles = [] } = useQuery<any[]>({
    queryKey: ['/api/roles'],
    enabled: showUseTemplate,
  });

  const useTemplateMutation = useMutation({
    mutationFn: async ({ templateId, recipients }: { templateId: number, recipients: string[] }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/templates/${templateId}/send-to-selected`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ recipients }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/templates'] });
      setShowUseTemplate(false);
      setSelectedTemplate(null);
      setSelectedRecipients([]);
      setRecipientFilter({ role: "all", searchName: "" });
      toast({
        title: "Template Sent",
        description: data.message || `Email sent successfully to ${data.successCount} recipients.`,
      });
    },
    onError: (error: any) => {
      console.error("Error sending template:", error);
      toast({
        title: "Failed to Send Template",
        description: error.message || "An error occurred while sending the template. Please try again.",
        variant: "destructive"
      });
    }
  });

  const editTemplateMutation = useMutation({
    mutationFn: async ({ templateId, templateData }: { templateId: number, templateData: any }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(templateData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/templates'] });
      setShowEditTemplate(false);
      setSelectedTemplate(null);
      setEditingTemplate({
        name: "",
        category: "general",
        subject: "",
        content: ""
      });
      toast({
        title: "Template Updated",
        description: "Your message template has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error updating template:", error);
      toast({
        title: "Failed to Update Template",
        description: error.message || "An error occurred while updating the template. Please try again.",
        variant: "destructive"
      });
    }
  });

  const copyTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          category: template.category,
          subject: template.subject,
          content: template.content
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/templates'] });
      toast({
        title: "Template Copied",
        description: "Template has been copied successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error copying template:", error);
      toast({
        title: "Failed to Copy Template",
        description: error.message || "An error occurred while copying the template. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleUseTemplate = (template: any) => {
    setSelectedTemplate(template);
    setSelectedRecipients([]);  // Start with no recipients selected
    setRecipientFilter({ role: "all", searchName: "" });
    setShowUseTemplate(true);
  };

  const handleEditTemplate = (template: any) => {
    setSelectedTemplate(template);
    setEditingTemplate({
      name: template.name,
      category: template.category,
      subject: template.subject,
      content: template.content
    });
    setShowEditTemplate(true);
  };

  const handleCopyTemplate = (template: any) => {
    copyTemplateMutation.mutate(template);
  };

  const handleConfirmUseTemplate = () => {
    if (selectedTemplate && selectedRecipients.length > 0) {
      const recipientEmails = selectedRecipients.map(user => user.email);
      useTemplateMutation.mutate({ 
        templateId: selectedTemplate.id, 
        recipients: recipientEmails 
      });
    } else {
      toast({
        title: "No Recipients Selected",
        description: "Please select at least one recipient to send the email.",
        variant: "destructive"
      });
    }
  };

  const handleAddRecipient = (user: any) => {
    if (!selectedRecipients.find(r => r.id === user.id)) {
      setSelectedRecipients([...selectedRecipients, user]);
    }
  };

  const handleRemoveRecipient = (userId: number) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== userId));
  };

  const handleSelectAllFiltered = () => {
    const filtered = getFilteredUsers();
    const newRecipients = [...selectedRecipients];
    filtered.forEach((user: any) => {
      if (!newRecipients.find(r => r.id === user.id)) {
        newRecipients.push(user);
      }
    });
    setSelectedRecipients(newRecipients);
  };

  const getFilteredUsers = () => {
    return allUsers.filter((user: any) => {
      const matchesRole = recipientFilter.role === "all" || user.role === recipientFilter.role;
      const matchesName = !recipientFilter.searchName || 
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(recipientFilter.searchName.toLowerCase()) ||
        user.email.toLowerCase().includes(recipientFilter.searchName.toLowerCase());
      return matchesRole && matchesName;
    });
  };

  const handleConfirmEditTemplate = () => {
    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (selectedTemplate) {
      editTemplateMutation.mutate({
        templateId: selectedTemplate.id,
        templateData: editingTemplate
      });
    }
  };

  // Campaign mutations
  const editCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, campaignData }: { campaignId: number, campaignData: any }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(campaignData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      setShowEditCampaign(false);
      setSelectedCampaign(null);
      setEditingCampaign({
        name: "",
        type: "email",
        subject: "",
        content: "",
        template: "default",
        status: "draft",
        scheduledAt: "",
        recipientCount: 0,
        recipients: []
      });
      toast({
        title: "Campaign Updated",
        description: "Your campaign has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error updating campaign:", error);
      toast({
        title: "Failed to Update Campaign",
        description: error.message || "An error occurred while updating the campaign. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Helper function to generate a unique duplicate campaign name
  const generateDuplicateCampaignName = (originalName: string, existingCampaigns: any[], excludeCampaignId?: number): string => {
    // Remove any existing "(Copy)" or "(Copy N)" suffix
    const baseName = originalName.replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/, '').trim();
    
    // Find all campaigns that start with the base name and have a "(Copy)" suffix
    // Exclude the campaign being duplicated
    const copyPattern = /^(.+?)\s*\(Copy(?:\s+(\d+))?\)\s*$/;
    const existingCopies: number[] = [];
    
    existingCampaigns.forEach((c: any) => {
      // Skip the campaign being duplicated
      if (excludeCampaignId && c.id === excludeCampaignId) {
        return;
      }
      
      const match = c.name.match(copyPattern);
      if (match) {
        const existingBase = match[1].trim();
        if (existingBase === baseName) {
          const copyNumber = match[2] ? parseInt(match[2], 10) : 1;
          existingCopies.push(copyNumber);
        }
      }
    });
    
    // Also check if the base name itself exists (without any copy suffix)
    // Exclude the campaign being duplicated
    const baseNameExists = existingCampaigns.some((c: any) => {
      if (excludeCampaignId && c.id === excludeCampaignId) {
        return false;
      }
      return c.name.trim() === baseName;
    });
    
    // Find the next available copy number
    let nextCopyNumber = 1;
    if (baseNameExists || existingCopies.length > 0) {
      const maxCopyNumber = existingCopies.length > 0 ? Math.max(...existingCopies) : 0;
      nextCopyNumber = maxCopyNumber + 1;
    }
    
    // Generate the new name
    return nextCopyNumber === 1 
      ? `${baseName} (Copy)`
      : `${baseName} (Copy ${nextCopyNumber})`;
  };

  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaign: any) => {
      const token = localStorage.getItem('auth_token');
      
      // Get current campaigns from cache to check for existing names
      const cachedCampaigns = queryClient.getQueryData<any[]>(['/api/messaging/campaigns']) || [];
      const duplicateName = generateDuplicateCampaignName(campaign.name, cachedCampaigns, campaign.id);
      
      const response = await fetch('/api/messaging/campaigns', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: duplicateName,
          type: campaign.type,
          subject: campaign.subject,
          content: campaign.content,
          template: campaign.template,
          status: "draft",
          recipientCount: 0,
          sentCount: 0,
          openRate: 0,
          clickRate: 0
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      toast({
        title: "Campaign Duplicated",
        description: "Campaign has been duplicated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error duplicating campaign:", error);
      toast({
        title: "Failed to Duplicate Campaign",
        description: error.message || "An error occurred while duplicating the campaign. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleEditCampaign = (campaign: any) => {
    setSelectedCampaign(campaign);
    setEditingCampaign({
      name: campaign.name,
      type: campaign.type,
      subject: campaign.subject,
      content: campaign.content,
      template: campaign.template || "default",
      status: campaign.status || "draft",
      scheduledAt: campaign.scheduledAt || "",
      recipientCount: campaign.recipientCount || 0,
      recipients: campaign.recipients || []
    });
    setEditCampaignRecipientRole("");
    setEditCampaignRecipientName("");
    setEditCampaignRecipientPhone("");
    setShowEditCampaign(true);
  };

  const handleViewCampaign = (campaign: any) => {
    setViewingCampaign(campaign);
    setShowViewCampaignRecipients(false);
    setShowViewCampaign(true);
  };

  const getEditCampaignFilteredRecipients = () => {
    if (editCampaignRecipientRole === 'patient') {
      return patientsData || [];
    }
    if (editCampaignRecipientRole) {
      return (usersData || []).filter((u: any) => u.role === editCampaignRecipientRole);
    }
    return [];
  };

  const addEditCampaignRecipient = () => {
    if (!editCampaignRecipientName) {
      toast({
        title: "Validation Error",
        description: "Please select a recipient name.",
        variant: "destructive"
      });
      return;
    }

    const recipientsList = editCampaignRecipientRole === 'patient' 
      ? (patientsData || []) 
      : (usersData || []).filter((u: any) => u.role === editCampaignRecipientRole || !editCampaignRecipientRole);
    
    const recipient = recipientsList.find((r: any) => `${r.firstName} ${r.lastName}` === editCampaignRecipientName);
    
    if (!recipient) {
      toast({
        title: "Error",
        description: "Recipient not found.",
        variant: "destructive"
      });
      return;
    }

    if (editingCampaign.recipients.some(r => r.id === recipient.id)) {
      toast({
        title: "Already Added",
        description: "This recipient is already in the list.",
        variant: "destructive"
      });
      return;
    }

    const phone = editCampaignRecipientPhone || recipient.phone || recipient.phoneNumber || recipient.mobile || '';
    const email = recipient.email || '';

    setEditingCampaign(prev => ({
      ...prev,
      recipients: [...prev.recipients, {
        id: recipient.id,
        name: `${recipient.firstName} ${recipient.lastName}`,
        role: editCampaignRecipientRole,
        phone,
        email
      }],
      recipientCount: prev.recipients.length + 1
    }));

    setEditCampaignRecipientRole("");
    setEditCampaignRecipientName("");
    setEditCampaignRecipientPhone("");
  };

  const removeEditCampaignRecipient = (recipientId: number) => {
    setEditingCampaign(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r.id !== recipientId),
      recipientCount: prev.recipients.length - 1
    }));
  };

  const handleDuplicateCampaign = (campaign: any) => {
    duplicateCampaignMutation.mutate(campaign);
  };

  const handleConfirmEditCampaign = () => {
    if (!editingCampaign.name.trim() || !editingCampaign.subject.trim() || !editingCampaign.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (selectedCampaign) {
      editCampaignMutation.mutate({
        campaignId: selectedCampaign.id,
        campaignData: editingCampaign
      });
    }
  };

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      toast({
        title: "Campaign Deleted",
        description: "Campaign has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting campaign:", error);
      toast({
        title: "Failed to Delete Campaign",
        description: error.message || "An error occurred while deleting the campaign. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDeleteCampaign = (campaign: any) => {
    setCampaignToDelete(campaign);
    setShowDeleteCampaign(true);
  };

  const handleConfirmDeleteCampaign = () => {
    if (campaignToDelete) {
      deleteCampaignMutation.mutate(campaignToDelete.id);
      setShowDeleteCampaign(false);
      setCampaignToDelete(null);
    }
  };

  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSendingCampaignId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/campaigns'] });
      setCampaignSummary({
        totalRecipients: data.totalRecipients,
        totalSent: data.totalSent,
        totalFailed: data.totalFailed,
        deliveryLog: data.deliveryLog || []
      });
      setShowCampaignSummary(true);
      toast({
        title: "Campaign Sent",
        description: `Successfully sent to ${data.totalSent} recipients.`,
      });
    },
    onError: (error: any) => {
      setSendingCampaignId(null);
      console.error("Error sending campaign:", error);
      toast({
        title: "Failed to Send Campaign",
        description: error.message || "An error occurred while sending the campaign.",
        variant: "destructive"
      });
    }
  });

  const handleSendExistingCampaign = (campaign: any, event?: React.MouseEvent) => {
    // Prevent event propagation to avoid multiple triggers
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Prevent sending if already sending this campaign
    if (sendingCampaignId === campaign.id) {
      return;
    }
    
    // Check if campaign has recipients - check both recipients array and recipientCount
    const hasRecipients = (campaign.recipients && Array.isArray(campaign.recipients) && campaign.recipients.length > 0) || 
                          (campaign.recipientCount && campaign.recipientCount > 0);
    
    if (!hasRecipients) {
      toast({
        title: "Failed to Send Campaign",
        description: "No recipients in this campaign. Please add recipients before sending.",
        variant: "destructive"
      });
      return;
    }
    
    // Allow resending even if status is 'sent' (that's what "Resend Campaign" is for)
    setSendingCampaignId(campaign.id);
    sendCampaignMutation.mutate(campaign.id);
  };

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messaging/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/templates'] });
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting template:", error);
      toast({
        title: "Failed to Delete Template",
        description: error.message || "An error occurred while deleting the template. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDeleteTemplate = (template: any) => {
    setTemplateToDelete(template);
    setShowDeleteTemplate(true);
  };

  const handleConfirmDeleteTemplate = () => {
    if (templateToDelete) {
      deleteTemplateMutation.mutate(templateToDelete.id);
      setShowDeleteTemplate(false);
      setTemplateToDelete(null);
    }
  };

  // Polling-based real-time messaging as WebSocket fallback
  useEffect(() => {
    if (!currentUser) {
      console.log('🔗 Real-time: No currentUser, skipping connection');
      return;
    }

    console.log('🔗 Setting up polling-based real-time messaging for user:', currentUser.id);
    
    // Reduced polling interval to prevent UI blinking
    const messagePollingInterval = setInterval(() => {
      // Only poll if user is on messaging page and WebSocket is not connected
      if (selectedConversation && fetchMessages) {
        fetchMessages(selectedConversation);
      }
      
      // Less frequent conversation refresh to reduce API calls
      refetchConversations();
    }, 5000); // Check every 5 seconds instead of 2
    
    // Also attempt WebSocket as primary method with robust URL construction
    const url = new URL('/ws', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url.toString();
    console.log('🔗 WebSocket: URL:', wsUrl);
    
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('🔗 WebSocket connected successfully');
      try {
        // Authenticate with the server
        const authMessage = {
          type: 'auth',
          userId: currentUser.id
        };
        console.log('🔗 WebSocket: Sending authentication:', authMessage);
        socket.send(JSON.stringify(authMessage));
      } catch (error) {
        console.error('❌ WebSocket authentication error:', error);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data);
        
        if (data.type === 'new_message') {
          console.log('📨 WebSocket message received:', data);
          console.log('🔄 New message received via WebSocket, refreshing UI immediately');
          
          // Extract conversationId from different possible locations
          const messageConversationId = data.data?.conversationId || data.message?.conversationId || data.conversationId;
          console.log('🔍 Extracted conversationId for WebSocket:', messageConversationId);
          
          // Force immediate refresh of current conversation if it matches
          if (selectedConversation && messageConversationId === selectedConversation && fetchMessages) {
            console.log('🔥 IMMEDIATE REFETCH - Current conversation matches WebSocket message');
            fetchMessages(selectedConversation);
          }
          
          // Always refresh conversations to update sidebar
          console.log('🔥 FORCE REFETCH ALL CONVERSATIONS - WebSocket triggered');
          refetchConversations();
          
          // Show toast notification
          toast({
            title: "New Message",
            description: `New message received`,
          });
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('🔗 WebSocket disconnected:', event.code, event.reason);
      // Log disconnection but don't force reload - polling will handle real-time updates
      if (event.code === 1006) {
        console.log('🔄 Abnormal WebSocket closure detected - polling system will maintain real-time updates');
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket connection error:', error);
      // Prevent unhandled promise rejections
      if (error instanceof Error) {
        return Promise.resolve();
      }
    };

    // Cleanup on unmount
    return () => {
      console.log('🔗 Real-time: Cleaning up polling and WebSocket connection');
      clearInterval(messagePollingInterval);
      socket.close();
    };
  }, [currentUser, toast, selectedConversation, fetchMessages]);

  const handleSendNewMessage = () => {
    // Reset validation errors
    const errors: {
      recipientRole?: string;
      recipientName?: string;
      subject?: string;
      phoneNumber?: string;
      content?: string;
    } = {};

    // Validate required fields
    if (user?.role === 'admin' || user?.role === 'patient') {
      if (!selectedRecipientRole.trim()) {
        errors.recipientRole = "Please select a role";
      }
      if (!selectedRecipientUser.trim()) {
        errors.recipientName = "Please select a recipient";
      }
    } else {
      if (!newMessage.recipient.trim()) {
        errors.recipientName = "Please select a recipient";
      }
    }

    if (!newMessage.subject.trim()) {
      errors.subject = "Please enter a subject";
    }

    if (!newMessage.content.trim()) {
      errors.content = "Please enter message content";
    }

    // Validate phone number for SMS/WhatsApp/Voice
    if ((newMessage.messageType === 'sms' || newMessage.messageType === 'whatsapp' || newMessage.messageType === 'voice') && !newMessage.phoneNumber.trim()) {
      errors.phoneNumber = "Please enter a phone number";
    }

    // Set validation errors
    setValidationErrors(errors);

    // If there are any errors, don't proceed
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Determine the message type - if sending via SMS/WhatsApp/Email/Voice externally, type should be "patient" not "internal"
    const effectiveType = (newMessage.messageType === 'email' || newMessage.messageType === 'sms' || newMessage.messageType === 'whatsapp' || newMessage.messageType === 'voice') 
      ? 'patient' 
      : newMessage.type;

    sendMessageMutation.mutate({
      recipientId: newMessage.recipient,
      subject: newMessage.subject,
      content: newMessage.content,
      priority: newMessage.priority,
      type: effectiveType,
      phoneNumber: newMessage.phoneNumber,
      messageType: newMessage.messageType
    });
  };

  const handleSendConversationMessage = async () => {
    if (!newMessageContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a message.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedConversation) {
      toast({
        title: "Error",
        description: "Please select a conversation first.",
        variant: "destructive"
      });
      return;
    }

    const messageContent = newMessageContent.trim();
    console.log('Sending message to conversation:', selectedConversation);
    console.log('Message content:', messageContent);
    
    // Store a temporary message ID for optimistic update
    const tempMessageId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempMessageId,
      senderId: currentUser?.id,
      senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'You',
      senderRole: currentUser?.role || 'user',
      recipientId: '',
      recipientName: '',
      subject: '',
      content: messageContent,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'normal' as const,
      type: 'internal' as const,
      isStarred: false
    };
    
    // Optimistically add message to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessageContent(""); // Clear input immediately
    
    try {
      // Find the other participant (patient) in the conversation
      const currentConversation = conversations.find((c: Conversation) => c.id === selectedConversation);
      const otherParticipant = currentConversation?.participants?.find((p: any) => 
        p.id !== currentUser?.id
      );
      
      // For patient conversations, get phone from stored messages or participant
      const phoneNumber = messages?.[0]?.phoneNumber || otherParticipant?.phone;
      const messageType = 'sms'; // Default to SMS for external messages
      
      // Determine if this should be sent as external SMS (only for patients with phone numbers)
      const isExternalMessage = phoneNumber && messageType && otherParticipant?.role === 'patient';
      
      // Debug logging
      console.log('🔍 SMS DETECTION DEBUG:');
      console.log('  Other participant:', otherParticipant);
      console.log('  Phone number:', phoneNumber);
      console.log('  Message type:', messageType);
      console.log('  Is external:', isExternalMessage);
      
      const messageData = {
        conversationId: selectedConversation,
        content: messageContent,
        priority: 'normal',
        type: isExternalMessage ? 'patient' : 'internal',
        phoneNumber: isExternalMessage ? phoneNumber : undefined,
        messageType: isExternalMessage ? messageType : undefined
      };
      console.log('🔥 CONVERSATION MESSAGE DATA:', messageData);
      console.log('🔥 Selected conversation ID:', selectedConversation);
      
      // Use direct API call with proper error handling (avoids false error notifications)
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(messageData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to send message: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('🔥 CONVERSATION MESSAGE RESPONSE:', responseData);
      
      // Replace the optimistic message with the real one from server
      setMessages(prev => {
        // Remove the temporary message and add the real one
        const filtered = prev.filter(m => m.id !== tempMessageId);
        const realMessage = {
          id: responseData.id,
          senderId: responseData.senderId || currentUser?.id,
          senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'You',
          senderRole: currentUser?.role || 'user',
          recipientId: responseData.recipientId,
          recipientName: responseData.recipientName,
          subject: responseData.subject || '',
          content: responseData.content || messageContent,
          timestamp: responseData.timestamp || new Date().toISOString(),
          isRead: false,
          priority: responseData.priority || 'normal',
          type: responseData.type || 'internal',
          isStarred: false
        };
        return [...filtered, realMessage];
      });
      
      // Update conversations cache for persistence
      const currentConversations = queryClient.getQueryData(['/api/messaging/conversations']) as any[] || [];
      const existingConversation = currentConversations.find(conv => conv.id === responseData.conversationId);
      
      if (!existingConversation) {
        // New conversation created - force complete cache refresh
        console.log('🔄 NEW CONVERSATION DETECTED - forcing complete refresh');
        queryClient.removeQueries({ queryKey: ['/api/messaging/conversations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      } else {
        // Update existing conversation cache
        const updatedConversations = currentConversations.map(conv => {
          if (conv.id === responseData.conversationId) {
            return {
              ...conv,
              lastMessage: {
                id: responseData.id,
                content: responseData.content,
                priority: responseData.priority || "normal",
                timestamp: responseData.timestamp || new Date().toISOString(),
                senderId: responseData.senderId
              },
              updatedAt: new Date().toISOString()
            };
          }
          return conv;
        });
        queryClient.setQueryData(['/api/messaging/conversations'], updatedConversations);
        queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
      }
      
      // Refetch messages to ensure we have the latest data from server (with a small delay to ensure server has processed)
      console.log('🔥 FORCE IMMEDIATE UI UPDATE: Triggering direct fetch after send');
      setTimeout(async () => {
        if (selectedConversation && fetchMessages) {
          console.log('🔥 Using direct fetch for immediate message visibility');
          await fetchMessages(selectedConversation);
          console.log('🔥 DIRECT FETCH COMPLETED after message send');
        }
      }, 500);
      
      // Show success notification
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
      
    } catch (error: any) {
      // Remove the optimistic message since send failed
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      
      // Restore the message content if send failed
      setNewMessageContent(messageContent);
      console.error('🔥 CONVERSATION MESSAGE ERROR:', error);
      
      // Show error notification only on actual failure
      toast({
        title: "Error", 
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  };



  const handleStartVideoCall = async () => {
    if (!videoCall.participant.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select a participant for the video call.",
        variant: "destructive"
      });
      return;
    }

    const participantName = videoCall.participant;
    
    try {
      // Create BigBlueButton meeting
      const response = await fetch('/api/video-conference/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingName: `Consultation with ${participantName}`,
          participantName: participantName,
          duration: parseInt(videoCall.duration),
          maxParticipants: videoCall.type === 'team_meeting' ? 20 : 2
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create video conference');
      }

      const meetingData = await response.json();

      // Open BigBlueButton meeting in new window
      const meetingWindow = window.open(
        meetingData.moderatorJoinUrl,
        'bbb-meeting',
        'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no'
      );

      if (!meetingWindow) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for video conferencing and try again.",
          variant: "destructive"
        });
        return;
      }

      // Close dialog and start call interface
      setShowVideoCall(false);
      setCallParticipant(participantName);
      setActiveVideoCall(true);
      setCallDuration(0);
      
      // Store meeting info for ending later
      setMeetingInfo({
        meetingID: meetingData.meetingID,
        moderatorPassword: meetingData.moderatorPassword
      });
      
      toast({
        title: "Video Conference Started",
        description: `BigBlueButton meeting created for ${participantName}`,
      });

      // Start call timer
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setCallTimer(timer);

      // Monitor window closure
      const checkClosed = setInterval(() => {
        if (meetingWindow.closed) {
          clearInterval(checkClosed);
          handleEndVideoCall();
        }
      }, 1000);

      // Show connection success after delay
      setTimeout(() => {
        toast({
          title: "Meeting Ready",
          description: `Video conference with ${participantName} is now accessible in the new window`,
        });
      }, 2000);

    } catch (error) {
      console.error('Error creating video conference:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to create video conference. Please try again.",
        variant: "destructive"
      });
    }

    // Reset form
    setVideoCall({
      participant: "",
      type: "consultation",
      duration: "30",
      scheduled: false,
      scheduledTime: ""
    });
  };

  const handleEndVideoCall = async () => {
    // End BigBlueButton meeting if we have meeting info
    if (meetingInfo) {
      try {
        const response = await fetch(`/api/video-conference/end/${meetingInfo.meetingID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            moderatorPassword: meetingInfo.moderatorPassword
          })
        });

        if (response.ok) {
          toast({
            title: "Meeting Ended",
            description: "BigBlueButton meeting has been terminated.",
          });
        }
      } catch (error) {
        console.error('Error ending meeting:', error);
      }
    }

    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Clear timer
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    
    setActiveVideoCall(false);
    setCallParticipant("");
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOn(true);
    setMeetingInfo(null);
    
    toast({
      title: "Call Ended",
      description: "Video call has been terminated.",
    });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Microphone On" : "Microphone Muted",
      description: isMuted ? "You are now unmuted" : "You are now muted",
    });
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    toast({
      title: isVideoOn ? "Camera Off" : "Camera On",
      description: isVideoOn ? "Your video is now off" : "Your video is now on",
    });
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Delete conversation function
  const handleDeleteConversation = (conversationId: string) => {
    deleteConversationMutation.mutate(conversationId);
  };

  const filteredConversations = (conversations || []).filter((conv: Conversation) => {
    if (messageFilter === "unread" && conv.unreadCount === 0) return false;
    if (messageFilter === "patients" && !conv.isPatientConversation) return false;
    if (messageFilter === "staff" && conv.isPatientConversation) return false;
    if (searchQuery && conv.lastMessage && !conv.lastMessage.subject?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });



  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'scheduled': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'paused': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'draft': return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  if (conversationsLoading || campaignsLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }



  return (
    <div>
      {/* Top row: Header + Theme Toggle */}
      <div className="flex items-center justify-between mr-6 bg-white px-2 py-1 rounded">
        <Header
          title="Messaging Center"
          subtitle="Secure communication with patients and staff"
        />

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">Theme:</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Healthcare Quick Actions */}
      <div className="flex items-center gap-4 mb-4 px-6 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setNewMessage({
                  recipient: "",
                  subject: "Appointment Reminder",
                  content: "Hi {{patientName}},\n\nThis is a reminder that you have an appointment scheduled on {{appointmentDate}} with {{doctorName}} at {{clinicName}}.\n\nPlease arrive 15 minutes early for check-in.\n\nIf you need to reschedule, please call us.\n\nThank you,\n{{clinicName}}",
                  priority: "normal",
                  type: "patient",
                  phoneNumber: "",
                  messageType: "sms"
                });
                setShowNewMessage(true);
              }}
            >
              📅 Appointment Reminder
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setNewMessage({
                  recipient: "",
                  subject: "Lab Results Available",
                  content: "Hi {{patientName}},\n\nYour lab results are now available for review.\n\nPlease call us at {{clinicPhone}} or visit your patient portal to discuss the results with your provider.\n\nBest regards,\n{{clinicName}}",
                  priority: "normal",
                  type: "patient",
                  phoneNumber: "",
                  messageType: "sms"
                });
                setShowNewMessage(true);
              }}
            >
              🧪 Lab Results
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setNewMessage({
                  recipient: "",
                  subject: "Prescription Ready",
                  content: "Hi {{patientName}},\n\nYour prescription is ready for pickup at:\n{{pharmacyName}}\n{{pharmacyAddress}}\n\nPlease bring a valid ID when collecting your medication.\n\nThank you!",
                  priority: "normal",
                  type: "patient",
                  phoneNumber: "",
                  messageType: "sms"
                });
                setShowNewMessage(true);
              }}
            >
              💊 Prescription Ready
            </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => updateDeliveryStatusMutation.mutate()}
            disabled={updateDeliveryStatusMutation.isPending}
            title="Update delivery status for pending messages"
          >
            {updateDeliveryStatusMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Update Delivery Status
          </Button>
          <Dialog open={showVideoCall} onOpenChange={setShowVideoCall}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Video className="h-4 w-4 mr-2" />
                Video Call
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Start Video Call</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
{(user?.role === 'admin' || user?.role === 'patient') ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectCallRole">Select Role *</Label>
                      <Select 
                        value={selectedRecipientRole} 
                        onValueChange={(value) => {
                          setSelectedRecipientRole(value);
                          setSelectedRecipientUser("");
                          setVideoCall(prev => ({ ...prev, participant: "" }));
                        }}
                      >
                        <SelectTrigger data-testid="select-call-recipient-role">
                          <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rolesData.map((role: any) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.displayName || role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="selectCallName">Select Name *</Label>
                      <Select 
                        value={selectedRecipientUser} 
                        onValueChange={(value) => {
                          setSelectedRecipientUser(value);
                          setVideoCall(prev => ({ ...prev, participant: value }));
                        }}
                        disabled={!selectedRecipientRole}
                      >
                        <SelectTrigger data-testid="select-call-recipient-name">
                          <SelectValue placeholder={selectedRecipientRole ? "Select a name..." : "Select role first..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredRecipients.map((recipient: any) => (
                            <SelectItem 
                              key={recipient.id} 
                              value={`${recipient.firstName} ${recipient.lastName}`}
                              data-testid={`call-recipient-option-${recipient.id}`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{recipient.firstName} {recipient.lastName}</span>
                                <span className="text-sm text-gray-500">{recipient.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="callParticipant">Recipient *</Label>
                    <div className="relative">
                      <Input
                        id="callParticipant"
                        placeholder="Search patients..."
                        value={videoCallPatientSearch}
                        onChange={(e) => setVideoCallPatientSearch(e.target.value)}
                      />
                      {videoCallPatientSearch && filteredVideoCallPatients.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredVideoCallPatients.map((patient: any) => (
                            <div
                              key={patient.id}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                              onClick={() => {
                                setSelectedVideoCallPatient(`${patient.firstName} ${patient.lastName}`);
                                setVideoCallPatientSearch(`${patient.firstName} ${patient.lastName}`);
                                setVideoCall(prev => ({ ...prev, participant: `${patient.firstName} ${patient.lastName}` }));
                              }}
                            >
                              <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                              <div className="text-sm text-gray-500">{patient.email} • {patient.patientId}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="callType">Call Type</Label>
                    <Select 
                      value={videoCall.type} 
                      onValueChange={(value: "consultation" | "team_meeting" | "emergency") => 
                        setVideoCall(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultation">Patient Consultation</SelectItem>
                        <SelectItem value="team_meeting">Team Meeting</SelectItem>
                        <SelectItem value="emergency">Emergency Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callDuration">Expected Duration</Label>
                    <Select 
                      value={videoCall.duration} 
                      onValueChange={(value: "15" | "30" | "60" | "90") => 
                        setVideoCall(prev => ({ ...prev, duration: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="scheduleCall"
                      checked={videoCall.scheduled}
                      onChange={(e) => setVideoCall(prev => ({ ...prev, scheduled: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="scheduleCall">Schedule for later</Label>
                  </div>
                  
                  {videoCall.scheduled && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">Scheduled Time</Label>
                      <Input
                        id="scheduledTime"
                        type="datetime-local"
                        value={videoCall.scheduledTime}
                        onChange={(e) => setVideoCall(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Video Call Features</span>
                  </div>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• HD video and audio quality</li>
                    <li>• Screen sharing capability</li>
                    <li>• Recording option for consultations</li>
                    <li>• Secure end-to-end encryption</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowVideoCall(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleStartVideoCall}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {videoCall.scheduled ? "Schedule Call" : "Start Call"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showNewMessage} onOpenChange={(open) => {
            setShowNewMessage(open);
            if (!open) {
              resetNewMessage();
            }
          }}>
            {canCreate('messaging') && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </DialogTrigger>
            )}
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Compose New Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* From/Sender Field */}
                <div className="space-y-2">
                  <Label htmlFor="message-sender">From</Label>
                  {isDoctor ? (
                    <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                      {formatRoleLabel(user?.role)} {user?.firstName} {user?.lastName}
                    </div>
                  ) : (
                    <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                      {user?.firstName} {user?.lastName}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {(user?.role === 'admin' || user?.role === 'patient') ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="selectRole">Select Role *</Label>
                        <Select 
                          value={selectedRecipientRole} 
                          onValueChange={(value) => {
                            setSelectedRecipientRole(value);
                            setSelectedRecipientUser("");
                            setNewMessage(prev => ({ ...prev, recipient: "", phoneNumber: "" }));
                            setValidationErrors(prev => ({ ...prev, recipientRole: undefined }));
                          }}
                        >
                          <SelectTrigger data-testid="select-recipient-role" className={validationErrors.recipientRole ? "border-red-500" : ""}>
                            <SelectValue placeholder="Select a role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {rolesData.map((role: any) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.displayName || role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.recipientRole && (
                          <p className="text-sm text-red-500">{validationErrors.recipientRole}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="selectName">Select Name *</Label>
                        <Select 
                          value={selectedRecipientUser} 
                          onValueChange={(value) => {
                            setSelectedRecipientUser(value);
                            setNewMessage(prev => ({ ...prev, recipient: value }));
                            setValidationErrors(prev => ({ ...prev, recipientName: undefined }));
                            
                            // Auto-populate phone number for patient role
                            if (selectedRecipientRole === 'patient') {
                              const patient = (patientsData || []).find((p: any) => `${p.firstName} ${p.lastName}` === value);
                              if (patient && (patient.phone || patient.phoneNumber || patient.mobile)) {
                                setNewMessage(prev => ({ 
                                  ...prev, 
                                  recipient: value,
                                  phoneNumber: patient.phone || patient.phoneNumber || patient.mobile || ""
                                }));
                              }
                            }
                          }}
                          disabled={!selectedRecipientRole}
                        >
                          <SelectTrigger data-testid="select-recipient-name" className={validationErrors.recipientName ? "border-red-500" : ""}>
                            <SelectValue placeholder={selectedRecipientRole ? "Select a name..." : "Select role first..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredRecipients.map((recipient: any) => (
                              <SelectItem 
                                key={recipient.id} 
                                value={`${recipient.firstName} ${recipient.lastName}`}
                                data-testid={`recipient-option-${recipient.id}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{recipient.firstName} {recipient.lastName}</span>
                                  <span className="text-sm text-gray-500">{recipient.email}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.recipientName && (
                          <p className="text-sm text-red-500">{validationErrors.recipientName}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="messageRecipient">Recipient *</Label>
                      <Select 
                        value={selectedMessagePatient} 
                        onValueChange={(value) => {
                          const patient = (patientsData || []).find((p: any) => `${p.firstName} ${p.lastName}` === value);
                          if (patient) {
                            setSelectedMessagePatient(value);
                            setNewMessage(prev => ({ 
                              ...prev, 
                              recipient: value,
                              phoneNumber: patient.phone || patient.phoneNumber || patient.mobile || ""
                            }));
                            setValidationErrors(prev => ({ ...prev, recipientName: undefined }));
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-patient-recipient" className={validationErrors.recipientName ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select a patient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(patientsData || []).map((patient: any) => (
                            <SelectItem 
                              key={patient.id} 
                              value={`${patient.firstName} ${patient.lastName}`}
                              data-testid={`patient-option-${patient.id}`}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                                <span className="text-sm text-gray-500">{patient.email} • {patient.patientId}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.recipientName && (
                        <p className="text-sm text-red-500">{validationErrors.recipientName}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="messageSubject">Subject *</Label>
                    <Input
                      id="messageSubject"
                      placeholder="Enter message subject"
                      value={newMessage.subject}
                      onChange={(e) => {
                        setNewMessage(prev => ({ ...prev, subject: e.target.value }));
                        setValidationErrors(prev => ({ ...prev, subject: undefined }));
                      }}
                      className={validationErrors.subject ? "border-red-500" : ""}
                    />
                    {validationErrors.subject && (
                      <p className="text-sm text-red-500">{validationErrors.subject}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="messagePriority">Priority</Label>
                    <Select 
                      value={newMessage.priority} 
                      onValueChange={(value: "low" | "normal" | "high" | "urgent") => 
                        setNewMessage(prev => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="messageType">Message Type</Label>
                    <Select 
                      value={newMessage.messageType} 
                      onValueChange={(value: "sms" | "email" | "whatsapp" | "voice") => 
                        setNewMessage(prev => ({ ...prev, messageType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="voice">Phone Call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(newMessage.messageType === 'sms' || newMessage.messageType === 'whatsapp' || newMessage.messageType === 'voice') && (
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input 
                        id="phoneNumber"
                        placeholder="Enter phone number (e.g., +44 7123 456789)"
                        value={newMessage.phoneNumber}
                        onChange={(e) => {
                          setNewMessage(prev => ({ ...prev, phoneNumber: e.target.value }));
                          setValidationErrors(prev => ({ ...prev, phoneNumber: undefined }));
                        }}
                        className={validationErrors.phoneNumber ? "border-red-500" : ""}
                      />
                      {validationErrors.phoneNumber && (
                        <p className="text-sm text-red-500">{validationErrors.phoneNumber}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="messageContent">Message Content *</Label>
                  <Textarea
                    id="messageContent"
                    placeholder="Enter your message content..."
                    rows={8}
                    value={newMessage.content}
                    onChange={(e) => {
                      setNewMessage(prev => ({ ...prev, content: e.target.value }));
                      setValidationErrors(prev => ({ ...prev, content: undefined }));
                    }}
                    className={validationErrors.content ? "border-red-500" : ""}
                  />
                  {validationErrors.content && (
                    <p className="text-sm text-red-500">{validationErrors.content}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewMessage(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSendNewMessage}
                    disabled={sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

      {/* Messaging Content */}
      <div className="flex-1 overflow-auto p-6">
      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Announcement</TabsTrigger>
        </TabsList>
        <TabsContent value="conversations" className="space-y-6">
          <div className="grid grid-cols-12 gap-6 h-[700px]">
            {/* Conversations List */}
            <div className="col-span-4 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg">
              <div className="p-4 border-b border-gray-200 dark:border-slate-600">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                    <Input
                      placeholder="Search conversations..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Select value={messageFilter} onValueChange={setMessageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter messages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="patients">Patients</SelectItem>
                    <SelectItem value="staff">Staff Only</SelectItem>
                    <SelectItem value="starred">Starred</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[550px]">
                <div className="p-2">
                  {/* New Conversation Option */}
                  {/* Show existing conversations first */}
                  {filteredConversations && filteredConversations.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 px-1">📩 Click conversation below to send messages:</h3>
                      {filteredConversations.map((conversation: Conversation) => (
                        <div
                          key={conversation.id}
                          className={`p-4 rounded-xl cursor-pointer mb-3 transition-all duration-200 border-2 shadow-sm ${
                            selectedConversation === conversation.id
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 shadow-md'
                              : 'hover:bg-green-50 dark:hover:bg-green-900/30 border-green-300 dark:border-green-700 hover:border-green-500 dark:hover:border-green-500 bg-white dark:bg-slate-700 hover:shadow-md'
                          }`}
                          onClick={() => {
                            console.log('🔥 CONVERSATION SELECTED:', conversation.id);
                            console.log('🔥 Setting selectedConversation to:', conversation.id);
                            setSelectedConversation(conversation.id);
                          }}
                        >
                          <div className="flex items-start gap-4 relative">
                            <div className="relative flex-shrink-0">
                              <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-600 shadow-sm">
                                <AvatarFallback className="bg-green-500 text-white text-lg font-semibold">
                                  {String(getOtherParticipant(conversation)?.name || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {conversation.unreadCount > 0 && (
                                <Badge variant="destructive" className="absolute -top-2 -right-2 text-xs min-w-[22px] h-6 flex items-center justify-center p-1 shadow-sm">
                                  {conversation.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate leading-tight">
                                    {(() => {
                                      const otherParticipant = getOtherParticipant(conversation);
                                      if (otherParticipant?.name && otherParticipant.name !== 'undefined') {
                                        return otherParticipant.name;
                                      }
                                      if (otherParticipant?.id && otherParticipant.id !== 'undefined') {
                                        return `User ${otherParticipant.id}`;
                                      }
                                      return 'Unknown User';
                                    })()}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs px-2 py-1">
                                      {getOtherParticipant(conversation)?.role || 'user'}
                                    </Badge>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {conversation.lastMessage?.timestamp ? new Date(conversation.lastMessage.timestamp).toLocaleDateString() : ''}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 ml-3 text-red-600 border-red-300 hover:text-white hover:bg-red-600 hover:border-red-600 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-700 dark:hover:text-white flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete conversation with ${getOtherParticipant(conversation)?.name || 'Unknown User'}? This action cannot be undone.`)) {
                                      handleDeleteConversation(conversation.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                {conversation.lastMessage?.content || "No messages yet"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-600">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 px-1">Or create new conversation:</p>
                    <div
                      className="p-2 rounded-lg cursor-pointer transition-colors border border-dashed border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-25 dark:hover:bg-slate-700"
                      onClick={() => setShowNewMessage(true)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-slate-600 flex items-center justify-center">
                          <Plus className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-300">New Message</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(!filteredConversations || filteredConversations.length === 0) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No existing conversations found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Message Thread */}
            <div className="col-span-8 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Message Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {(() => {
                            const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                            return conv ? String(getOtherParticipant(conv)?.name || 'U').charAt(0).toUpperCase() : 'U';
                          })()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {(() => {
                            const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                            return conv ? getOtherParticipant(conv)?.name : '';
                          })()}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {(() => {
                            const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                            return conv ? getOtherParticipant(conv)?.role : '';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                          if (conv) {
                            const participant = getOtherParticipant(conv);
                            if (participant) {
                              startLiveKitAudioCall(participant);
                            }
                          }
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                          if (conv) {
                            const participant = getOtherParticipant(conv);
                            if (participant) startLiveKitVideoCall(participant);
                          }
                        }}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Star className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {(() => {
                        console.log('🔥 RENDERING MESSAGES - Count:', messages.length);
                        console.log('🔥 RENDERING MESSAGES - Data:', JSON.stringify(messages, null, 2));
                        return null;
                      })()}
                      {messages.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No messages in this conversation</p>
                        </div>
                      ) : (
                        messages.map((message: Message, index: number) => {
                          console.log(`🔥 RENDERING MESSAGE ${index}:`, message.id, message.content);
                          return (
                            <div key={message.id} className="flex gap-3 border-l-4 border-blue-200 pl-2 py-2" style={{ backgroundColor: '#f8f9fa', minHeight: '60px' }}>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-blue-500 text-white">
                                  {message.senderName?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{message.senderName}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {format(new Date(message.timestamp), 'MMM d, HH:mm')}
                                  </span>
                                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(message.priority)}`}></div>
                                </div>
                                <div className="bg-blue-50 dark:bg-slate-700 rounded-lg p-3 border border-blue-200">
                                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{message.content}</p>
                                  {message.attachments && message.attachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {message.attachments.map((attachment) => (
                                        <div key={attachment.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                                          <Paperclip className="h-3 w-3" />
                                          <span>{attachment.name}</span>
                                          <span className="text-gray-500 dark:text-gray-400">({(attachment.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        // Open new message dialog with pre-filled content
                                        setNewMessage(prev => ({
                                          ...prev,
                                          content: message.content,
                                          subject: `Forwarded: ${message.subject || 'Message'}`,
                                          priority: message.priority || "normal"
                                        }));
                                        setValidationErrors({});
                                        setShowNewMessage(true);
                                      }}
                                    >
                                      <Forward className="mr-2 h-4 w-4" />
                                      Forward
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      toast({ title: "Tag", description: `Tagging message: ${message.content.substring(0, 30)}...` });
                                    }}>
                                      <Tag className="mr-2 h-4 w-4" />
                                      Tag
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={async () => {
                                        try {
                                          console.log('🗑️ DELETING MESSAGE:', message.id);
                                          
                                          const token = localStorage.getItem('auth_token');
                                          const response = await fetch(`/api/messaging/messages/${message.id}`, {
                                            method: 'DELETE',
                                            headers: {
                                              'Authorization': `Bearer ${token}`,
                                              'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo',
                                              'Content-Type': 'application/json'
                                            },
                                            credentials: 'include'
                                          });
                                          
                                          if (!response.ok) {
                                            if (response.status === 404) {
                                              console.log('🗑️ Message already deleted or not found');
                                              toast({ 
                                                title: "Message Already Deleted", 
                                                description: "This message has already been deleted" 
                                              });
                                              // Still trigger UI refresh to clean up any stale UI state
                                              if (selectedConversation && fetchMessages) {
                                                await fetchMessages(selectedConversation);
                                              }
                                              return;
                                            }
                                            throw new Error(`${response.status}: ${response.statusText}`);
                                          }
                                          
                                          console.log('🗑️ DELETE SUCCESS - updating UI immediately');
                                          
                                          // Get current messages BEFORE clearing cache
                                          const currentMessages = messages as any[] || [];
                                          const updatedMessages = currentMessages.filter(msg => msg.id !== message.id);
                                          
                                          console.log('🗑️ MESSAGES BEFORE DELETE:', currentMessages.length);
                                          console.log('🗑️ MESSAGES AFTER DELETE:', updatedMessages.length);
                                          
                                          // CRITICAL FIX: Force immediate UI update using direct fetch bypass
                                          console.log('🗑️ FORCE RE-RENDER: Triggering direct fetch after delete');
                                          
                                          // Use direct fetch approach to bypass React Query cache completely
                                          if (selectedConversation && fetchMessages) {
                                            console.log('🗑️ Using direct fetch for immediate UI update');
                                            await fetchMessages(selectedConversation);
                                          }
                                          
                                          // Also force refetch conversations 
                                          // await refetchConversations();
                                          
                                          console.log('🗑️ REFETCH COMPLETED - deleted message should disappear immediately');
                                          
                                          toast({ 
                                            title: "Message Deleted", 
                                            description: "Message has been deleted successfully" 
                                          });
                                        } catch (error) {
                                          console.error('Delete error:', error);
                                          toast({ 
                                            title: "Error", 
                                            description: "Failed to delete message", 
                                            variant: "destructive" 
                                          });
                                        }
                                      }}
                                      className="text-red-600 dark:text-red-400"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {/* Message Composer */}
                  <div className="p-4 border-t border-gray-200 dark:border-slate-600 bg-blue-50 dark:bg-slate-700">
                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                      💬 Reply to this conversation
                    </div>
                    <div className="flex gap-3">
                      <Textarea
                        key={`message-input-${selectedConversation}`}
                        placeholder="Type your reply here..."
                        value={newMessageContent}
                        onChange={(e) => setNewMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (newMessageContent.trim()) {
                              handleSendConversationMessage();
                            }
                          }
                        }}
                        className="flex-1 min-h-[80px] bg-white dark:bg-slate-600"
                      />
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm"
                          onClick={handleSendConversationMessage}
                          disabled={!newMessageContent.trim()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">Select a conversation</h3>
                    <p className="text-sm">Choose a conversation from the list to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <div className="border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-slate-600">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">SMS Messages</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    View all SMS messages sent through the system via Twilio
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                      try {
                        // Invalidate and refetch to ensure fresh data
                        queryClient.invalidateQueries({ queryKey: ['/api/messaging/sms-messages'] });
                        await refetchSmsMessages();
                      } catch (error) {
                        console.error('Error refreshing SMS messages:', error);
                        toast({
                          title: "Error",
                          description: "Failed to refresh SMS messages",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={smsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${smsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Badge variant="outline" className="text-sm">
                    {(smsMessages || []).length} messages
                  </Badge>
                </div>
              </div>
            </div>
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-4">
                {smsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (smsMessages || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h4 className="text-lg font-medium mb-2">No SMS Messages</h4>
                    <p className="text-sm text-muted-foreground max-w-md">
                      SMS messages sent through the "New Message" dialog will appear here.
                      Select SMS as the communication method and provide a phone number.
                    </p>
                  </div>
                ) : (
                  (smsMessages || []).map((msg: any) => (
                    <div 
                      key={msg.id} 
                      className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover-elevate"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {msg.patientFirstName && msg.patientLastName 
                                ? `${msg.patientFirstName} ${msg.patientLastName}`
                                : msg.recipientName || msg.phoneNumber || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">{msg.phoneNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              msg.deliveryStatus === 'delivered' ? 'default' : 
                              msg.deliveryStatus === 'sent' ? 'secondary' : 
                              msg.deliveryStatus === 'failed' ? 'destructive' : 'outline'
                            }
                          >
                            {msg.deliveryStatus === 'delivered' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {msg.deliveryStatus === 'sent' && <Send className="h-3 w-3 mr-1" />}
                            {msg.deliveryStatus === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                            {msg.deliveryStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {msg.deliveryStatus || 'Pending'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {msg.createdAt ? format(new Date(msg.createdAt), 'MMM dd, HH:mm') : ''}
                          </span>
                        </div>
                      </div>
                      <div className="pl-13">
                        <p className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-slate-900 p-3 rounded-md">
                          {msg.content}
                        </p>
                        {msg.externalMessageId && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Twilio ID: {msg.externalMessageId}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Messaging Campaigns</h2>
            <div className="flex items-center gap-4">
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={campaignSubTab === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignSubTab("all")}
                  className="rounded-none"
                  data-testid="button-all-campaigns-tab"
                >
                  All Campaigns
                </Button>
                <Button
                  variant={campaignSubTab === "history" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignSubTab("history")}
                  className="rounded-none"
                  data-testid="button-campaign-history-tab"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  SMS Campaign History
                </Button>
                <Button
                  variant={campaignSubTab === "email_history" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCampaignSubTab("email_history")}
                  className="rounded-none"
                  data-testid="button-email-campaign-history-tab"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Email Campaign History
                </Button>
              </div>
            {canCreate('messaging') && (
              <Dialog open={showCreateCampaign} onOpenChange={setShowCreateCampaign}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaignName">Campaign Name *</Label>
                      <Popover open={campaignNamePopoverOpen} onOpenChange={setCampaignNamePopoverOpen}>
                        <PopoverTrigger asChild>
                          <div className="relative">
                            <Input
                              id="campaignName"
                              placeholder="Search or enter campaign name..."
                              value={newCampaign.name}
                              onChange={(e) => {
                                setNewCampaign(prev => ({ ...prev, name: e.target.value }));
                                if (!campaignNamePopoverOpen) setCampaignNamePopoverOpen(true);
                              }}
                              onClick={() => setCampaignNamePopoverOpen(true)}
                              data-testid="input-campaign-name"
                              className="pr-8"
                            />
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 max-h-[400px] overflow-y-auto" align="start">
                          <ScrollArea className="h-[350px]">
                            <div className="p-2">
                              {(() => {
                                const searchTerm = newCampaign.name.toLowerCase().trim();
                                const filteredCategories = Object.entries(CAMPAIGN_NAME_SUGGESTIONS)
                                  .map(([category, suggestions]) => ({
                                    category,
                                    filtered: suggestions.filter(s => 
                                      searchTerm === '' || s.toLowerCase().includes(searchTerm)
                                    )
                                  }))
                                  .filter(({ filtered }) => filtered.length > 0);
                                
                                if (filteredCategories.length === 0) {
                                  return (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                      No matching campaigns found. You can use your custom name.
                                    </div>
                                  );
                                }
                                
                                return filteredCategories.map(({ category, filtered }) => (
                                  <div key={category} className="mb-3">
                                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted rounded mb-1">
                                      {category}
                                    </div>
                                    {filtered.map((suggestion) => (
                                      <Button
                                        key={suggestion}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-left h-8 px-2"
                                        onClick={() => {
                                          setNewCampaign(prev => ({ ...prev, name: suggestion }));
                                          setCampaignNamePopoverOpen(false);
                                        }}
                                        data-testid={`campaign-suggestion-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
                                      >
                                        {suggestion}
                                      </Button>
                                    ))}
                                  </div>
                                ));
                              })()}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="campaignType">Campaign Type</Label>
                      <Select 
                        value={newCampaign.type} 
                        onValueChange={(value: "email" | "sms" | "both") => {
                          setNewCampaign(prev => ({ ...prev, type: value, recipients: [] }));
                          setCampaignRecipientRole("");
                          setCampaignRecipientName("");
                          setCampaignRecipientPhone("");
                        }}
                      >
                        <SelectTrigger data-testid="select-campaign-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>Email Only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              <span>SMS Only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="both">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <Smartphone className="h-4 w-4" />
                              <span>Email & SMS</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Campaign Type Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Campaign Method:</span>
                    {newCampaign.type === 'email' && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <Mail className="h-3 w-3 mr-1" /> Email Campaign
                      </Badge>
                    )}
                    {newCampaign.type === 'sms' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <Smartphone className="h-3 w-3 mr-1" /> SMS Campaign
                      </Badge>
                    )}
                    {newCampaign.type === 'both' && (
                      <>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          <Mail className="h-3 w-3 mr-1" /> Email
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Smartphone className="h-3 w-3 mr-1" /> SMS
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* Recipient Selection - for all campaign types */}
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <Label className="font-semibold">Add Recipients</Label>
                      <span className="text-xs text-muted-foreground ml-2">
                        {newCampaign.type === 'email' ? '(Email addresses will be used)' : 
                         newCampaign.type === 'sms' ? '(Phone numbers will be used)' : 
                         '(Both email and phone will be used)'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="campaignRecipientRole">Select Role</Label>
                        <Select 
                          value={campaignRecipientRole} 
                          onValueChange={(value) => {
                            setCampaignRecipientRole(value);
                            setCampaignRecipientName("");
                            setCampaignRecipientPhone("");
                          }}
                        >
                          <SelectTrigger data-testid="select-campaign-recipient-role">
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="patient">Patient</SelectItem>
                            {rolesData.filter((r: any) => r.name !== 'patient').map((role: any) => (
                              <SelectItem key={role.id} value={role.name}>
                                {role.displayName || role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="campaignRecipientName">Select Name</Label>
                        <Select 
                          value={campaignRecipientName} 
                          onValueChange={(value) => {
                            setCampaignRecipientName(value);
                            const recipients = getCampaignFilteredRecipients();
                            const recipient = recipients.find((r: any) => `${r.firstName} ${r.lastName}` === value);
                            if (recipient) {
                              setCampaignRecipientPhone(recipient.phone || recipient.phoneNumber || recipient.mobile || '');
                            }
                          }}
                          disabled={!campaignRecipientRole}
                        >
                          <SelectTrigger data-testid="select-campaign-recipient-name">
                            <SelectValue placeholder={campaignRecipientRole ? "Select name..." : "Select role first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {getCampaignFilteredRecipients().map((r: any) => (
                              <SelectItem key={r.id} value={`${r.firstName} ${r.lastName}`}>
                                {r.firstName} {r.lastName} {r.email ? `(${r.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(newCampaign.type === 'sms' || newCampaign.type === 'both') && (
                        <div className="space-y-2">
                          <Label htmlFor="campaignRecipientPhone">Phone Number</Label>
                          <Input
                            id="campaignRecipientPhone"
                            placeholder="Enter phone number"
                            value={campaignRecipientPhone}
                            onChange={(e) => setCampaignRecipientPhone(e.target.value)}
                            data-testid="input-campaign-recipient-phone"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button 
                          onClick={addCampaignRecipient} 
                          className="w-full"
                          disabled={!campaignRecipientName}
                          data-testid="button-add-campaign-recipient"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>

                    {/* Recipients List */}
                    {newCampaign.recipients.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm text-muted-foreground mb-2 block">
                          Selected Recipients ({newCampaign.recipients.length})
                        </Label>
                        <ScrollArea className="h-32 border rounded-md p-2 bg-white dark:bg-gray-800">
                          <div className="space-y-2">
                            {newCampaign.recipients.map((recipient) => (
                              <div key={recipient.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {recipient.role}
                                  </Badge>
                                  <span className="font-medium text-sm">{recipient.name}</span>
                                  {(newCampaign.type === 'sms' || newCampaign.type === 'both') && (
                                    <span className="text-sm text-muted-foreground">{recipient.phone || 'No phone'}</span>
                                  )}
                                  {(newCampaign.type === 'email' || newCampaign.type === 'both') && (
                                    <span className="text-sm text-muted-foreground">{recipient.email || 'No email'}</span>
                                  )}
                                </div>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => removeCampaignRecipient(recipient.id)}
                                  data-testid={`button-remove-recipient-${recipient.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaignSubject">Subject Line *</Label>
                    <Input
                      id="campaignSubject"
                      placeholder="Enter subject line"
                      value={newCampaign.subject}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, subject: e.target.value }))}
                      data-testid="input-campaign-subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="campaignContent">Message Content *</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Personalization Tags:</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setNewCampaign(prev => ({ ...prev, content: prev.content + '[FirstName]' }))}
                          data-testid="button-insert-firstname"
                        >
                          [FirstName]
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setNewCampaign(prev => ({ ...prev, content: prev.content + '[LastName]' }))}
                          data-testid="button-insert-lastname"
                        >
                          [LastName]
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="campaignContent"
                      placeholder="Enter your campaign message content... Use [FirstName] and [LastName] for personalization."
                      rows={6}
                      value={newCampaign.content}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, content: e.target.value }))}
                      data-testid="textarea-campaign-content"
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: "Hello [FirstName], your update from Cura Healthcare EMR."
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaignTemplate">Template</Label>
                    <Select 
                      value={newCampaign.template} 
                      onValueChange={(value) => 
                        setNewCampaign(prev => ({ ...prev, template: value }))
                      }
                    >
                      <SelectTrigger data-testid="select-campaign-template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                        <SelectItem value="health_tip">Health Tip</SelectItem>
                        <SelectItem value="vaccination_reminder">Vaccination Reminder</SelectItem>
                        <SelectItem value="follow_up">Follow-up Care</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Send or Schedule Options */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <Label className="font-semibold">Send Options</Label>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="sendNow"
                          name="sendMode"
                          checked={newCampaign.sendMode === 'now'}
                          onChange={() => setNewCampaign(prev => ({ ...prev, sendMode: 'now' }))}
                          className="w-4 h-4"
                          data-testid="radio-send-now"
                        />
                        <Label htmlFor="sendNow" className="cursor-pointer">Send Now</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="schedule"
                          name="sendMode"
                          checked={newCampaign.sendMode === 'schedule'}
                          onChange={() => setNewCampaign(prev => ({ ...prev, sendMode: 'schedule' }))}
                          className="w-4 h-4"
                          data-testid="radio-schedule"
                        />
                        <Label htmlFor="schedule" className="cursor-pointer">Schedule for Later</Label>
                      </div>
                    </div>

                    {newCampaign.sendMode === 'schedule' && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="scheduledDateTime">Date & Time</Label>
                          <Input
                            id="scheduledDateTime"
                            type="datetime-local"
                            value={newCampaign.scheduledDateTime}
                            onChange={(e) => setNewCampaign(prev => ({ ...prev, scheduledDateTime: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                            data-testid="input-scheduled-datetime"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">Time Zone</Label>
                          <Select 
                            value={newCampaign.timezone} 
                            onValueChange={(value) => setNewCampaign(prev => ({ ...prev, timezone: value }))}
                          >
                            <SelectTrigger data-testid="select-timezone">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                              <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                              <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
                              <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                              <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                              <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                              <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                              <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                              <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Time will be converted to UTC before sending.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowCreateCampaign(false);
                        resetCampaignForm();
                      }}
                      data-testid="button-cancel-campaign"
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={handleSaveCampaign}
                      disabled={createCampaignMutation.isPending || isSendingCampaign}
                      data-testid="button-save-draft-campaign"
                    >
                      {createCampaignMutation.isPending ? "Saving..." : newCampaign.sendMode === 'schedule' ? "Schedule Campaign" : "Save Draft"}
                    </Button>
                    {newCampaign.sendMode === 'now' && (
                      <Button 
                        onClick={handleSaveAndSendCampaign}
                        disabled={createCampaignMutation.isPending || isSendingCampaign}
                        data-testid="button-send-campaign"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {isSendingCampaign ? "Sending..." : "Save & Send Now"}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}

            {/* Sending Progress Dialog */}
            <Dialog open={showSendingProgress} onOpenChange={() => {}}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary animate-pulse" />
                    Sending Campaign
                  </DialogTitle>
                  <DialogDescription>
                    Sending SMS to recipients one by one...
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {sendingRecipients.map((recipient, index) => (
                    <div 
                      key={recipient.id}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        recipient.status === 'sent' 
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                          : recipient.status === 'failed'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : recipient.status === 'sending'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                      data-testid={`sending-recipient-${recipient.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {recipient.status === 'sent' && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {recipient.status === 'failed' && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          {recipient.status === 'sending' && (
                            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          )}
                          {recipient.status === 'pending' && (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{recipient.name}</div>
                          <div className="text-xs text-muted-foreground">{recipient.phone}</div>
                        </div>
                      </div>
                      <div className="text-xs">
                        {recipient.status === 'sent' && (
                          <span className="text-green-600 font-medium">Sent</span>
                        )}
                        {recipient.status === 'failed' && (
                          <span className="text-red-600 font-medium">Failed</span>
                        )}
                        {recipient.status === 'sending' && (
                          <span className="text-blue-600 font-medium">Sending...</span>
                        )}
                        {recipient.status === 'pending' && (
                          <span className="text-gray-500">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  {sendingRecipients.filter(r => r.status === 'sent').length} of {sendingRecipients.length} sent
                </div>
              </DialogContent>
            </Dialog>

            {/* Campaign Summary Dialog */}
            <Dialog open={showCampaignSummary} onOpenChange={setShowCampaignSummary}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Campaign Summary
                  </DialogTitle>
                </DialogHeader>
                {campaignSummary && (
                  <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-primary">{campaignSummary.totalRecipients}</div>
                          <div className="text-sm text-muted-foreground">Total Recipients</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">{campaignSummary.totalSent}</div>
                          <div className="text-sm text-muted-foreground">Successfully Sent</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold text-red-600">{campaignSummary.totalFailed}</div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Delivery Log */}
                    <div className="space-y-2">
                      <Label className="font-semibold">Delivery Log</Label>
                      <ScrollArea className="h-64 border rounded-md">
                        <div className="p-4 space-y-2">
                          {campaignSummary.deliveryLog.map((log, index) => (
                            <div 
                              key={index} 
                              className={`flex items-center justify-between p-3 rounded-md ${
                                log.status === 'sent' 
                                  ? 'bg-green-50 dark:bg-green-900/20' 
                                  : 'bg-red-50 dark:bg-red-900/20'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {log.status === 'sent' ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <div>
                                  <div className="font-medium text-sm">{log.recipient}</div>
                                  <div className="text-xs text-muted-foreground">{log.phone}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                                  {log.status}
                                </Badge>
                                {log.messageId && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ID: {log.messageId.substring(0, 15)}...
                                  </div>
                                )}
                                {log.error && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {log.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={() => {
                          setShowCampaignSummary(false);
                          setCampaignSummary(null);
                        }}
                        data-testid="button-close-summary"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* All Campaigns Tab */}
          {campaignSubTab === "all" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {!campaigns || campaigns.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="p-8 text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                  <p className="text-sm text-gray-600">Create your first messaging campaign to engage patients and staff.</p>
                </CardContent>
              </Card>
            ) : (
              campaigns.map((campaign: Campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <Badge className={getCampaignStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {campaign.type === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                        <span className="text-sm font-medium">{campaign.subject}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Recipients:</span>
                          <span className="ml-2 font-medium">{campaign.recipientCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Sent:</span>
                          <span className="ml-2 font-medium">{campaign.sentCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Open Rate:</span>
                          <span className="ml-2 font-medium">{campaign.openRate}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Click Rate:</span>
                          <span className="ml-2 font-medium">{campaign.clickRate}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewCampaign(campaign)}
                          data-testid={`button-view-campaign-${campaign.id}`}
                        >
                          View
                        </Button>
                        {canEdit('messaging') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCampaign(campaign)}
                          data-testid={`button-edit-campaign-${campaign.id}`}
                        >
                          Edit
                        </Button>
                        )}
                        {campaign.status !== 'sent' && (
                          <Button 
                            size="sm"
                            onClick={(e) => handleSendExistingCampaign(campaign, e)}
                            disabled={sendingCampaignId === campaign.id || sendCampaignMutation.isPending}
                            data-testid={`button-send-campaign-${campaign.id}`}
                          >
                            {sendingCampaignId === campaign.id ? "Sending..." : "Send Campaign"}
                          </Button>
                        )}
                        {campaign.status === 'sent' && (
                          <Button 
                            size="sm"
                            onClick={(e) => handleSendExistingCampaign(campaign, e)}
                            disabled={sendingCampaignId === campaign.id || sendCampaignMutation.isPending}
                            data-testid={`button-resend-campaign-${campaign.id}`}
                          >
                            {sendingCampaignId === campaign.id ? "Sending..." : "Resend Campaign"}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign)}
                          disabled={duplicateCampaignMutation.isPending}
                          data-testid={`button-duplicate-campaign-${campaign.id}`}
                        >
                          Duplicate
                        </Button>
                        {canDelete('messaging') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCampaign(campaign)}
                          disabled={deleteCampaignMutation.isPending}
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          )}

          {/* SMS Campaign History Tab */}
          {campaignSubTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">SMS Campaign History</h3>
              </div>
              
              {!campaigns || campaigns.filter((c: Campaign) => c.status === 'sent' && (c.type === 'sms' || c.type === 'both')).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No SMS campaigns sent yet</h3>
                    <p className="text-sm text-gray-600">SMS campaigns you send will appear here with their complete history.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {campaigns
                    .filter((c: Campaign) => c.status === 'sent' && (c.type === 'sms' || c.type === 'both'))
                    .sort((a: Campaign, b: Campaign) => {
                      const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
                      const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((campaign: Campaign) => (
                      <Card key={campaign.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-lg">{campaign.name}</h4>
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Sent
                                </Badge>
                                <Badge variant="outline">
                                  {campaign.type === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <Smartphone className="h-3 w-3 mr-1" />}
                                  {campaign.type.toUpperCase()}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Sent At</div>
                                  <div className="font-medium">
                                    {campaign.sentAt ? format(new Date(campaign.sentAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Recipients</div>
                                  <div className="font-medium">{campaign.recipientCount}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Delivered</div>
                                  <div className="font-medium text-green-600">{campaign.sentCount}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Open Rate</div>
                                  <div className="font-medium">{campaign.openRate}%</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Calendar className="h-3 w-3" />
                                Created: {format(new Date(campaign.createdAt), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewCampaign(campaign)}
                                data-testid={`button-view-history-campaign-${campaign.id}`}
                              >
                                View Details
                              </Button>
                              <Button 
                                size="sm"
                                onClick={(e) => handleSendExistingCampaign(campaign, e)}
                                disabled={sendingCampaignId === campaign.id || sendCampaignMutation.isPending}
                                data-testid={`button-resend-history-campaign-${campaign.id}`}
                              >
                                {sendingCampaignId === campaign.id ? "Sending..." : "Resend Campaign"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDuplicateCampaign(campaign)}
                                data-testid={`button-duplicate-history-campaign-${campaign.id}`}
                              >
                                Duplicate
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Email Campaign History Tab */}
          {campaignSubTab === "email_history" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Email Campaign History</h3>
              </div>
              
              {!campaigns || campaigns.filter((c: Campaign) => c.status === 'sent' && (c.type === 'email' || c.type === 'both')).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No email campaigns sent yet</h3>
                    <p className="text-sm text-gray-600">Email campaigns you send will appear here with their complete history.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {campaigns
                    .filter((c: Campaign) => c.status === 'sent' && (c.type === 'email' || c.type === 'both'))
                    .sort((a: Campaign, b: Campaign) => {
                      const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
                      const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((campaign: Campaign) => (
                      <Card key={campaign.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-lg">{campaign.name}</h4>
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Sent
                                </Badge>
                                <Badge variant="outline">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {campaign.type.toUpperCase()}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Sent At</div>
                                  <div className="font-medium">
                                    {campaign.sentAt ? format(new Date(campaign.sentAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Recipients</div>
                                  <div className="font-medium">{campaign.recipientCount}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Delivered</div>
                                  <div className="font-medium text-green-600">{campaign.sentCount}</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                  <div className="text-muted-foreground text-xs">Open Rate</div>
                                  <div className="font-medium">{campaign.openRate}%</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Calendar className="h-3 w-3" />
                                Created: {format(new Date(campaign.createdAt), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewCampaign(campaign)}
                                data-testid={`button-view-email-history-campaign-${campaign.id}`}
                              >
                                View Details
                              </Button>
                              <Button 
                                size="sm"
                                onClick={(e) => handleSendExistingCampaign(campaign, e)}
                                disabled={sendingCampaignId === campaign.id || sendCampaignMutation.isPending}
                                data-testid={`button-resend-email-history-campaign-${campaign.id}`}
                              >
                                {sendingCampaignId === campaign.id ? "Sending..." : "Resend Campaign"}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDuplicateCampaign(campaign)}
                                data-testid={`button-duplicate-email-history-campaign-${campaign.id}`}
                              >
                                Duplicate
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* Edit Campaign Dialog */}
          <Dialog open={showEditCampaign} onOpenChange={setShowEditCampaign}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Campaign</DialogTitle>
                <DialogDescription>
                  Update the campaign details below. Fields marked with * are required.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editCampaignName">Campaign Name *</Label>
                    <Input
                      id="editCampaignName"
                      placeholder="Enter campaign name"
                      value={editingCampaign.name}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                      data-testid="input-edit-campaign-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCampaignType">Campaign Type *</Label>
                    <Select
                      value={editingCampaign.type}
                      onValueChange={(value) => setEditingCampaign({ ...editingCampaign, type: value as any })}
                    >
                      <SelectTrigger data-testid="select-edit-campaign-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>Email</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="sms">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" />
                            <span>SMS</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="both">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <Smartphone className="h-4 w-4" />
                            <span>Both</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editCampaignStatus">Status</Label>
                    <Select
                      value={editingCampaign.status}
                      onValueChange={(value) => setEditingCampaign({ ...editingCampaign, status: value as any })}
                    >
                      <SelectTrigger data-testid="select-edit-campaign-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCampaignTemplate">Template</Label>
                    <Select
                      value={editingCampaign.template}
                      onValueChange={(value) => setEditingCampaign({ ...editingCampaign, template: value })}
                    >
                      <SelectTrigger data-testid="select-edit-campaign-template">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                        <SelectItem value="health_tip">Health Tip</SelectItem>
                        <SelectItem value="vaccination_reminder">Vaccination Reminder</SelectItem>
                        <SelectItem value="follow_up">Follow-up Care</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingCampaign.status === 'scheduled' && (
                  <div className="space-y-2">
                    <Label htmlFor="editCampaignScheduledAt">Scheduled Date & Time</Label>
                    <Input
                      id="editCampaignScheduledAt"
                      type="datetime-local"
                      value={editingCampaign.scheduledAt ? new Date(editingCampaign.scheduledAt).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, scheduledAt: e.target.value })}
                      data-testid="input-edit-campaign-scheduled-at"
                    />
                  </div>
                )}

                <div className="p-4 border rounded-lg bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <Label className="text-base font-medium">Add Recipients</Label>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="space-y-2">
                      <Label className="text-sm">Select Role</Label>
                      <Select
                        value={editCampaignRecipientRole}
                        onValueChange={(value) => {
                          setEditCampaignRecipientRole(value);
                          setEditCampaignRecipientName("");
                          setEditCampaignRecipientPhone("");
                        }}
                      >
                        <SelectTrigger data-testid="select-edit-recipient-role">
                          <SelectValue placeholder="Select role..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="patient">Patient</SelectItem>
                          <SelectItem value="doctor">Doctor</SelectItem>
                          <SelectItem value="nurse">Nurse</SelectItem>
                          <SelectItem value="receptionist">Receptionist</SelectItem>
                          <SelectItem value="administrator">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Select Name</Label>
                      <Select
                        value={editCampaignRecipientName}
                        onValueChange={(value) => {
                          setEditCampaignRecipientName(value);
                          const recipientsList = editCampaignRecipientRole === 'patient' 
                            ? (patientsData || []) 
                            : (usersData || []).filter((u: any) => u.role === editCampaignRecipientRole);
                          const recipient = recipientsList.find((r: any) => `${r.firstName} ${r.lastName}` === value);
                          if (recipient) {
                            setEditCampaignRecipientPhone(recipient.phone || recipient.phoneNumber || recipient.mobile || '');
                          }
                        }}
                        disabled={!editCampaignRecipientRole}
                      >
                        <SelectTrigger data-testid="select-edit-recipient-name">
                          <SelectValue placeholder={editCampaignRecipientRole ? "Select name" : "Select role first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {getEditCampaignFilteredRecipients().map((r: any) => (
                            <SelectItem key={r.id} value={`${r.firstName} ${r.lastName}`}>
                              {r.firstName} {r.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Phone Number</Label>
                      <Input
                        placeholder="Enter phone number"
                        value={editCampaignRecipientPhone}
                        onChange={(e) => setEditCampaignRecipientPhone(e.target.value)}
                        data-testid="input-edit-recipient-phone"
                      />
                    </div>
                    
                    <Button 
                      onClick={addEditCampaignRecipient}
                      className="bg-primary hover:bg-primary/90"
                      data-testid="button-add-edit-recipient"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  {editingCampaign.recipients.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Added Recipients ({editingCampaign.recipients.length})</Label>
                      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                        {editingCampaign.recipients.map((recipient) => (
                          <div key={recipient.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="capitalize text-xs">{recipient.role}</Badge>
                              </div>
                              <span className="font-semibold text-base">{recipient.name}</span>
                              <div className="flex flex-col gap-1">
                                {recipient.phone && (
                                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Phone className="h-3 w-3" />
                                    <span className="font-mono">{recipient.phone}</span>
                                  </div>
                                )}
                                {recipient.email && (
                                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Mail className="h-3 w-3" />
                                    <span>{recipient.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeEditCampaignRecipient(recipient.id)}
                              data-testid={`button-remove-edit-recipient-${recipient.id}`}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editCampaignSubject">Subject *</Label>
                  <Input
                    id="editCampaignSubject"
                    placeholder="Enter subject line"
                    value={editingCampaign.subject}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, subject: e.target.value })}
                    data-testid="input-edit-campaign-subject"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="editCampaignContent">Message Content *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Insert:</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingCampaign({ ...editingCampaign, content: editingCampaign.content + '[FirstName]' })}
                        data-testid="button-edit-insert-firstname"
                      >
                        [FirstName]
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingCampaign({ ...editingCampaign, content: editingCampaign.content + '[LastName]' })}
                        data-testid="button-edit-insert-lastname"
                      >
                        [LastName]
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="editCampaignContent"
                    placeholder="Enter your campaign message content..."
                    rows={6}
                    value={editingCampaign.content}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, content: e.target.value })}
                    data-testid="textarea-edit-campaign-content"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEditCampaign(false)}
                    data-testid="button-cancel-edit-campaign"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmEditCampaign}
                    disabled={editCampaignMutation.isPending}
                    data-testid="button-save-edit-campaign"
                  >
                    {editCampaignMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Campaign Dialog */}
          <Dialog open={showDeleteCampaign} onOpenChange={setShowDeleteCampaign}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Campaign</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the campaign "{campaignToDelete?.name}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteCampaign(false);
                    setCampaignToDelete(null);
                  }} 
                  data-testid="button-cancel-delete-campaign"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmDeleteCampaign} 
                  disabled={deleteCampaignMutation.isPending} 
                  data-testid="button-confirm-delete-campaign"
                >
                  {deleteCampaignMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Campaign Dialog */}
          <Dialog open={showViewCampaign} onOpenChange={setShowViewCampaign}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>Campaign Details</span>
                  {viewingCampaign && (
                    <Badge className={getCampaignStatusColor(viewingCampaign.status)}>
                      {viewingCampaign.status}
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              {viewingCampaign && (
                <div className="space-y-6">
                  {/* Campaign Header */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h3 className="text-xl font-semibold mb-2">{viewingCampaign.name}</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      {viewingCampaign.type === 'email' && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          <Mail className="h-3 w-3 mr-1" /> Email Campaign
                        </Badge>
                      )}
                      {viewingCampaign.type === 'sms' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Smartphone className="h-3 w-3 mr-1" /> SMS Campaign
                        </Badge>
                      )}
                      {viewingCampaign.type === 'both' && (
                        <>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <Mail className="h-3 w-3 mr-1" /> Email
                          </Badge>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Smartphone className="h-3 w-3 mr-1" /> SMS
                          </Badge>
                        </>
                      )}
                      <span className="text-sm text-muted-foreground">
                        Template: {viewingCampaign.template || 'Default'}
                      </span>
                    </div>
                  </div>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setShowViewCampaignRecipients(!showViewCampaignRecipients)}
                      data-testid="card-view-recipients"
                    >
                      <CardContent className="p-4 text-center">
                        <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                        <p className="text-2xl font-bold">{viewingCampaign.recipientCount || (viewingCampaign.recipients?.length || 0)}</p>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                        <p className="text-xs text-primary mt-1">{showViewCampaignRecipients ? 'Click to hide' : 'Click to view'}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Send className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold">{viewingCampaign.sentCount}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Mail className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold">{viewingCampaign.openRate}%</p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <CheckCircle className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                        <p className="text-2xl font-bold">{viewingCampaign.clickRate}%</p>
                        <p className="text-xs text-muted-foreground">Click Rate</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                      <p className="font-medium">{viewingCampaign.subject}</p>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Message Content</Label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                      <p className="whitespace-pre-wrap">{viewingCampaign.content}</p>
                    </div>
                  </div>

                  {/* Recipients - shown when clicking on Recipients card */}
                  {showViewCampaignRecipients && (
                    <div className="space-y-2 border-2 border-primary/20 rounded-lg p-4 bg-primary/5">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Campaign Recipients ({viewingCampaign.recipients?.length || 0})
                      </Label>
                      {viewingCampaign.recipients && viewingCampaign.recipients.length > 0 ? (
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto bg-background">
                          {viewingCampaign.recipients.map((recipient: any, index: number) => (
                            <div key={recipient.id || index} className="p-4">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="capitalize text-xs">{recipient.role}</Badge>
                                </div>
                                <span className="font-semibold text-base">{recipient.name}</span>
                                <div className="flex flex-col gap-1">
                                  {recipient.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                      <Phone className="h-3 w-3" />
                                      <span className="font-mono">{recipient.phone}</span>
                                    </div>
                                  )}
                                  {recipient.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                      <Mail className="h-3 w-3" />
                                      <span>{recipient.email}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-muted-foreground border rounded-lg bg-background">
                          No recipients added to this campaign yet.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Created At</Label>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingCampaign.createdAt ? format(new Date(viewingCampaign.createdAt), 'PPpp') : 'N/A'}</span>
                      </div>
                    </div>
                    {viewingCampaign.scheduledAt && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Scheduled At</Label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(viewingCampaign.scheduledAt), 'PPpp')}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    {canEdit('messaging') && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowViewCampaign(false);
                        handleEditCampaign(viewingCampaign);
                      }}
                      data-testid="button-view-to-edit-campaign"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Campaign
                    </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={() => handleDuplicateCampaign(viewingCampaign)}
                      disabled={duplicateCampaignMutation.isPending}
                      data-testid="button-view-duplicate-campaign"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                    <Button 
                      onClick={() => setShowViewCampaign(false)}
                      data-testid="button-close-view-campaign"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Message Announcement</h2>
            <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
              {canCreate('messaging') && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Announcement
                </Button>
              </DialogTrigger>
              )}
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateName">Announcement Name *</Label>
                      <Input
                        id="templateName"
                        placeholder="Enter Announcement name"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={newTemplate.category}
                        onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="preventive">Preventive</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="onboarding">Onboarding</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      placeholder="Enter subject line"
                      value={newTemplate.subject}
                      onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Message Content *</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter message content. Use {{variableName}} for dynamic content."
                      rows={8}
                      value={newTemplate.content}
                      onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Tip: Use placeholders like {'{{patientName}}'}, {'{{date}}'}, {'{{doctorName}}'} for dynamic content</p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateTemplate(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateTemplate}
                      disabled={createTemplateMutation.isPending}
                    >
                      {createTemplateMutation.isPending ? "Creating..." : "Create Announcement"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {templatesLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Loading templates...</p>
                </div>
              </CardContent>
            </Card>
          ) : !templates || templates.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Announcements Yet</h3>
                  <p className="mb-4">Create your first message announcement to get started.</p>
                  <Button onClick={() => setShowCreateTemplate(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Announcement
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template: any) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      </div>
                      <Badge variant={template.category === 'urgent' ? 'destructive' : 'secondary'}>
                        {template.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject:</p>
                      <p className="text-sm bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 p-2 rounded">{template.subject}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                        {template.content.substring(0, 100)}...
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Used {template.usageCount || 0} times</span>
                      <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleUseTemplate(template)}
                        data-testid={`button-use-template-${template.id}`}
                      >
                        Public Notice
                      </Button>
                      {canEdit('messaging') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCopyTemplate(template)}
                        disabled={copyTemplateMutation.isPending}
                        data-testid={`button-copy-template-${template.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {canDelete('messaging') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template)}
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Use Template Dialog */}
          <Dialog open={showUseTemplate} onOpenChange={setShowUseTemplate}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Template to Selected Users</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Template Details</h4>
                  {selectedTemplate && (
                    <>
                      <p className="text-sm text-blue-800 dark:text-blue-200"><strong>Name:</strong> {selectedTemplate.name}</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200"><strong>Subject:</strong> {selectedTemplate.subject}</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-2"><strong>Content Preview:</strong></p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{selectedTemplate.content.substring(0, 200)}...</p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Available Users Panel */}
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Available Users</h4>
                    
                    {/* Filters */}
                    <div className="space-y-3 mb-3">
                      <div className="space-y-2">
                        <Label htmlFor="filterRole" className="text-xs">Filter by Role</Label>
                        <Select
                          value={recipientFilter.role}
                          onValueChange={(value) => setRecipientFilter({ ...recipientFilter, role: value })}
                        >
                          <SelectTrigger id="filterRole" className="h-9" data-testid="select-filter-role">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {allRoles.map((role: any) => (
                              <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="filterName" className="text-xs">Search by Name or Email</Label>
                        <Input
                          id="filterName"
                          placeholder="Search name or email..."
                          value={recipientFilter.searchName}
                          onChange={(e) => setRecipientFilter({ ...recipientFilter, searchName: e.target.value })}
                          className="h-9"
                          data-testid="input-filter-name"
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="w-full"
                        data-testid="button-add-all-filtered"
                      >
                        Add All Filtered ({getFilteredUsers().length})
                      </Button>
                    </div>

                    {/* Available Users List */}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {getFilteredUsers().length > 0 ? (
                        getFilteredUsers().map((user: any) => (
                          <div 
                            key={user.id} 
                            className="flex items-center justify-between text-sm py-2 px-2 bg-gray-50 dark:bg-slate-700 rounded hover:bg-gray-100 dark:hover:bg-slate-600"
                          >
                            <div className="flex-1">
                              <p className="text-gray-700 dark:text-gray-200 font-medium">{user.firstName} {user.lastName}</p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">Role: {user.role}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddRecipient(user)}
                              disabled={selectedRecipients.find(r => r.id === user.id)}
                              data-testid={`button-add-recipient-${user.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No users match your filters</p>
                      )}
                    </div>
                  </div>

                  {/* Selected Recipients Panel */}
                  <div className="border rounded-md p-4 bg-green-50 dark:bg-green-900/10">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Email Recipients ({selectedRecipients.length} selected)
                    </h4>
                    
                    <div className="max-h-[400px] overflow-y-auto space-y-1">
                      {selectedRecipients.length > 0 ? (
                        selectedRecipients.map((user: any) => (
                          <div 
                            key={user.id} 
                            className="flex items-center justify-between text-sm py-2 px-2 bg-white dark:bg-slate-700 rounded"
                          >
                            <div className="flex-1">
                              <p className="text-gray-700 dark:text-gray-200 font-medium">{user.firstName} {user.lastName}</p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">{user.email}</p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">Role: {user.role}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecipient(user.id)}
                              data-testid={`button-remove-recipient-${user.id}`}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-gray-500 mb-2">No recipients selected</p>
                          <p className="text-xs text-gray-400">Add users from the left panel</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowUseTemplate(false);
                      setSelectedRecipients([]);
                      setRecipientFilter({ role: "all", searchName: "" });
                    }}
                    data-testid="button-cancel-use-template"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmUseTemplate}
                    disabled={useTemplateMutation.isPending || selectedRecipients.length === 0}
                    data-testid="button-send-template"
                  >
                    {useTemplateMutation.isPending ? "Sending..." : `Send to ${selectedRecipients.length} Recipients`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Template Dialog */}
          <Dialog open={showEditTemplate} onOpenChange={setShowEditTemplate}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTemplateName">Template Name *</Label>
                    <Input
                      id="editTemplateName"
                      placeholder="Enter template name"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      data-testid="input-edit-template-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editCategory">Category *</Label>
                    <Select
                      value={editingTemplate.category}
                      onValueChange={(value) => setEditingTemplate({ ...editingTemplate, category: value as any })}
                    >
                      <SelectTrigger data-testid="select-edit-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="preventive">Preventive</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editSubject">Subject *</Label>
                  <Input
                    id="editSubject"
                    placeholder="Enter subject line"
                    value={editingTemplate.subject}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    data-testid="input-edit-template-subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editContent">Message Content *</Label>
                  <Textarea
                    id="editContent"
                    placeholder="Enter message content. Use {{variableName}} for dynamic content."
                    rows={8}
                    value={editingTemplate.content}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                    data-testid="textarea-edit-template-content"
                  />
                  <p className="text-xs text-gray-500">Tip: Use placeholders like {'{{patientName}}'}, {'{{date}}'}, {'{{doctorName}}'} for dynamic content</p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEditTemplate(false)}
                    data-testid="button-cancel-edit-template"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmEditTemplate}
                    disabled={editTemplateMutation.isPending}
                    data-testid="button-save-edit-template"
                  >
                    {editTemplateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Template Dialog */}
          <Dialog open={showDeleteTemplate} onOpenChange={setShowDeleteTemplate}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Template</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the template "{templateToDelete?.name}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteTemplate(false);
                    setTemplateToDelete(null);
                  }} 
                  data-testid="button-cancel-delete-template"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmDeleteTemplate} 
                  disabled={deleteTemplateMutation.isPending} 
                  data-testid="button-confirm-delete-template"
                >
                  {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Messaging Analytics</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                Export Report
              </Button>
            </div>
          </div>

          {analyticsLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Loading analytics...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Messages</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{analytics.totalMessages || 2847}</p>
                      </div>
                      <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs">
                      <span className="text-green-600 dark:text-green-400 font-medium">+12.5%</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Response Rate</p>
                        <p className="text-2xl font-bold">{analytics.responseRate || '94.2%'}</p>
                      </div>
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCheck className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs">
                      <span className="text-green-600 font-medium">+2.1%</span>
                      <span className="text-gray-500 ml-1">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                        <p className="text-2xl font-bold">{analytics.avgResponseTime || '4.2h'}</p>
                      </div>
                      <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs">
                      <span className="text-red-600 font-medium">+0.3h</span>
                      <span className="text-gray-500 ml-1">from last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Campaign Reach</p>
                        <p className="text-2xl font-bold">{analytics.campaignReach || '18.5K'}</p>
                      </div>
                      <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs">
                      <span className="text-green-600 font-medium">+18.7%</span>
                      <span className="text-gray-500 ml-1">from last month</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Message Volume Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Internal Messages</span>
                        <span className="font-medium">1,254</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Patient Messages</span>
                        <span className="font-medium">892</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Broadcast Messages</span>
                        <span className="font-medium">701</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '35%' }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Template Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {templates.slice(0, 4).map((template: any, index: number) => (
                        <div key={template.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{template.name}</span>
                          </div>
                          <span className="text-sm font-medium">{template.usageCount}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Messaging Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Mail className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Campaign "Flu Vaccination Reminder" sent</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reached 1,240 patients • 2 hours ago</p>
                      </div>
                      <Badge variant="outline">Completed</Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Template "Lab Results Available" used 12 times</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">High engagement rate • 4 hours ago</p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Bulk message sent to Cardiology department</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">45 recipients • 6 hours ago</p>
                      </div>
                      <Badge variant="outline">Delivered</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>

      {/* Active Video Call Interface */}
      {activeVideoCall && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
            {/* Video Call Header */}
            <div className="bg-gray-900 text-white p-4 rounded-t-lg flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">Video Call with {callParticipant}</h3>
                  <p className="text-sm text-gray-300">Duration: {formatCallDuration(callDuration)} • Powered by BigBlueButton</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  Live Meeting
                </span>
              </div>
            </div>

            {/* Video Call Main Area */}
            <div className="flex-1 bg-gray-100 relative flex items-center justify-center">
              {/* Enhanced video feed with realistic effects */}
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden">
                {/* Video simulation with movement */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 via-purple-500 to-indigo-600 animate-pulse"></div>
                
                {/* Connection quality overlay */}
                <div className="absolute top-4 left-4 bg-black bg-opacity-60 rounded-lg px-3 py-2 z-10">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-1 h-3 bg-green-400 rounded animate-pulse"></div>
                      <div className="w-1 h-4 bg-green-400 rounded animate-pulse delay-75"></div>
                      <div className="w-1 h-5 bg-green-400 rounded animate-pulse delay-150"></div>
                      <div className="w-1 h-4 bg-green-400 rounded animate-pulse delay-200"></div>
                    </div>
                    <span className="text-white text-xs font-medium">HD • Secure</span>
                  </div>
                </div>

                {/* Participant info */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-32 h-32 bg-white bg-opacity-25 rounded-full flex items-center justify-center mb-6 mx-auto shadow-2xl animate-bounce">
                      <span className="text-4xl font-bold">{callParticipant.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-2 drop-shadow-lg">{callParticipant}</h3>
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <p className="text-lg font-medium">Connected • Speaking</p>
                    </div>
                    <p className="text-sm opacity-90 bg-black bg-opacity-30 px-3 py-1 rounded-full mb-3">Patient Consultation Session</p>
                    <div className="bg-blue-600 bg-opacity-80 px-4 py-2 rounded-lg">
                      <p className="text-sm font-medium">✓ BigBlueButton meeting is active in new window</p>
                      <p className="text-xs opacity-90">Switch to the meeting window for full video conference</p>
                    </div>
                  </div>
                </div>

                {/* Audio visualization bars */}
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-1">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-green-400 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 20 + 10}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.8s'
                      }}
                    ></div>
                  ))}
                </div>
                
                {/* Enhanced self video (small corner) */}
                <div className="absolute bottom-4 right-4 w-52 h-40 rounded-lg border-2 border-white overflow-hidden shadow-2xl z-20">
                  {isVideoOn ? (
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 relative">
                      {/* Simulated camera feed */}
                      <div className="absolute inset-0 bg-gradient-to-tl from-green-600 to-blue-500 animate-pulse opacity-75"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-white bg-opacity-40 rounded-full flex items-center justify-center mb-2 mx-auto animate-pulse">
                            <span className="text-xl font-bold">YOU</span>
                          </div>
                          <p className="text-xs font-medium bg-black bg-opacity-30 px-2 py-1 rounded">Camera Active</p>
                        </div>
                      </div>
                      {/* Microphone indicator */}
                      {!isMuted && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                          <span className="text-xs">🎤</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-center relative">
                      <div>
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-2 mx-auto">
                          <span className="text-xl">📹</span>
                        </div>
                        <p className="text-xs">Camera Off</p>
                      </div>
                      {/* Microphone indicator when video is off */}
                      {!isMuted && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                          <span className="text-xs">🎤</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video Call Controls */}
            <div className="bg-gray-800 p-4 rounded-b-lg flex justify-center items-center gap-4">
              <Button 
                onClick={toggleMute}
                variant="outline" 
                size="sm" 
                className={`text-white border-gray-600 hover:bg-gray-600 ${isMuted ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                {isMuted ? '🔇' : '🎤'}
              </Button>
              <Button 
                onClick={toggleVideo}
                variant="outline" 
                size="sm" 
                className={`text-white border-gray-600 hover:bg-gray-600 ${!isVideoOn ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                {isVideoOn ? '📹' : '📵'}
              </Button>
              <Button variant="outline" size="sm" className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                🖥️
              </Button>
              <Button variant="outline" size="sm" className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                💬
              </Button>
              <Button 
                onClick={handleEndVideoCall}
                className="bg-red-600 hover:bg-red-700 text-white px-6"
              >
                End Call
              </Button>
              <Button variant="outline" size="sm" className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                ⚙️
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LiveKit Video Call Modal */}
      <Dialog open={!!liveKitVideoCall} onOpenChange={(open) => !open && handleLiveKitVideoCallEnd()}>
        <DialogContent className="sm:max-w-4xl h-[80vh] p-0 overflow-hidden [&>button]:text-white [&>button]:hover:bg-white/20">
          <div className="w-full h-full">
            {liveKitVideoCall && (
              <LiveKitVideoCall
                roomName={liveKitVideoCall.roomName}
                participantName={getDisplayName(liveKitVideoCall.participant)}
                token={liveKitVideoCall.token}
                serverUrl={liveKitVideoCall.serverUrl}
                onDisconnect={handleLiveKitVideoCallEnd}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* LiveKit Audio Call Modal */}
      <Dialog open={!!liveKitAudioCall} onOpenChange={(open) => !open && handleLiveKitAudioCallEnd()}>
        <DialogContent className="sm:max-w-md">
          {liveKitAudioCall && (
            <LiveKitAudioCall
              roomName={liveKitAudioCall.roomName}
              participantName={getDisplayName(liveKitAudioCall.participant)}
              token={liveKitAudioCall.token}
              serverUrl={liveKitAudioCall.serverUrl}
              onDisconnect={handleLiveKitAudioCallEnd}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}