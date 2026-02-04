import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { getActiveSubdomain } from "@/lib/subdomain-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  RotateCcw,
  FileText,
  Download,
  Upload,
  Settings,
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  Camera,
  Image,
  Search,
  Plus,
  X,
  Filter,
  Copy,
  Save,
  Maximize,
  Edit,
  ArrowLeft,
  Trash,
  Volume2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface VoiceNote {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  type: "clinical_note" | "procedure_note" | "consultation" | "dictation";
  status: "recording" | "processing" | "completed" | "error";
  recordingDuration: number;
  transcript: string;
  confidence: number;
  medicalTerms: Array<{
    term: string;
    confidence: number;
    category: "diagnosis" | "medication" | "procedure" | "anatomy" | "symptom";
  }>;
  structuredData?: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
  };
  createdAt: string;
  audioFile?: string;
}

interface SmartTemplate {
  id: string;
  name: string;
  category:
    | "soap_note"
    | "procedure"
    | "consultation"
    | "discharge"
    | "admission";
  template: string;
  fields: Array<{
    name: string;
    type: "text" | "select" | "textarea";
    required: boolean;
    options?: string[];
  }>;
  autoComplete: boolean;
  usageCount: number;
}

interface ClinicalPhoto {
  id: string;
  patientId: string;
  patientName: string;
  type: "wound" | "rash" | "xray" | "procedure" | "general";
  filename: string;
  description: string;
  url: string;
  dateTaken: string;
  metadata: {
    camera: string;
    resolution: string;
    lighting: string;
  };
  annotations: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence?: number;
  }>;
  aiAnalysis?: {
    findings: string[];
    confidence: number;
    recommendations: string[];
  };
  createdAt: string;
}

export default function VoiceDocumentation() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(
    null,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioStorage, setAudioStorage] = useState<Map<string, string>>(
    new Map(),
  );
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedNoteType, setSelectedNoteType] = useState<string>("");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<VoiceNote | null>(null);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [localTemplates, setLocalTemplates] = useState<SmartTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SmartTemplate | null>(null);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [viewFullDialogOpen, setViewFullDialogOpen] = useState(false);
  const [annotateDialogOpen, setAnnotateDialogOpen] = useState(false);
  const [addToReportDialogOpen, setAddToReportDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [analyzeDialogOpen, setAnalyzeDialogOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedPhotoPatient, setSelectedPhotoPatient] = useState<string>("");
  const [selectedPhotoType, setSelectedPhotoType] = useState<string>("");
  const [photoDescription, setPhotoDescription] = useState<string>("");
  const [patientSearchTerm, setPatientSearchTerm] = useState<string>("");
  const [photoTypeSearchTerm, setPhotoTypeSearchTerm] = useState<string>("");
  const [showPatientDropdown, setShowPatientDropdown] =
    useState<boolean>(false);
  const [showPhotoTypeDropdown, setShowPhotoTypeDropdown] =
    useState<boolean>(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<any>(null);
  const [voiceNoteDeleteDialogOpen, setVoiceNoteDeleteDialogOpen] = useState(false);
  const [voiceNoteToDelete, setVoiceNoteToDelete] = useState<VoiceNote | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".searchable-dropdown")) {
        setShowPatientDropdown(false);
        setShowPhotoTypeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch voice notes
  const { data: voiceNotes, isLoading: notesLoading } = useQuery({
    queryKey: ["/api/voice-documentation/notes", refreshTrigger],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/voice-documentation/notes", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch voice notes");
      return response.json();
    },
  });

  // Fetch smart templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/voice-documentation/templates"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/voice-documentation/templates", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Fetch clinical photos
  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ["/api/voice-documentation/photos"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/voice-documentation/photos", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch photos");
      return response.json();
    },
  });

  // Fetch patients for dropdowns
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/patients", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch patients");
      return response.json();
    },
  });

  // Create voice note mutation
  const createVoiceNoteMutation = useMutation({
    mutationFn: async (data: {
      audioBlob: Blob;
      patientId: string;
      type: string;
      transcript?: string;
      duration?: number;
      confidence?: number;
      tempAudioUrl?: string;
      tempNoteId?: string;
    }) => {
      const token = localStorage.getItem("auth_token");
      console.log(
        "Making API call with token:",
        token ? "Token exists" : "No token",
      );
      console.log("Sending data:", {
        patientId: data.patientId,
        type: data.type,
        transcript: data.transcript,
        duration: data.duration,
        confidence: data.confidence,
      });

      const response = await fetch("/api/voice-documentation/notes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: data.patientId,
          type: data.type,
          transcript: data.transcript,
          duration: data.duration,
          confidence: data.confidence,
        }),
      });

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response body:", responseText);

      if (!response.ok) {
        throw new Error(
          `Failed to create voice note: ${response.status} - ${responseText}`,
        );
      }

      return JSON.parse(responseText);
    },
    onSuccess: async (newNote, variables) => {
      // Map the temporary audio URL to the actual note ID
      if (variables.tempAudioUrl && variables.tempNoteId) {
        setAudioStorage((prev) => {
          const newMap = new Map(prev);
          newMap.delete(variables.tempNoteId); // Remove temp mapping
          newMap.set(newNote.id, variables.tempAudioUrl); // Add actual note mapping
          return newMap;
        });
      } else {
        // Manual save - clear transcript
        setCurrentTranscript("");
      }

      setSuccessMessage("Voice note saved successfully!");
      setShowSuccessModal(true);

      // Trigger UI refresh by updating the refresh trigger
      setRefreshTrigger((prev) => prev + 1);
    },
    onError: (err, variables) => {
      toast({ title: "Failed to save voice note", variant: "destructive" });
    },
  });

  // Delete voice note mutation
  const deleteVoiceNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/voice-documentation/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("404: Voice note not found");
        }
        throw new Error("Failed to delete voice note");
      }
      return response.json();
    },
    onSuccess: async (data, noteId) => {
      // Clean up audio storage
      setAudioStorage((prev) => {
        const newMap = new Map(prev);
        newMap.delete(noteId);
        return newMap;
      });

      setSuccessMessage("Voice note deleted successfully!");
      setShowSuccessModal(true);
      console.log("Voice note deleted from backend:", noteId);

      // Trigger UI refresh by updating the refresh trigger
      setRefreshTrigger((prev) => prev + 1);
    },
    onError: (err, noteId) => {
      toast({ title: "Failed to delete voice note", variant: "destructive" });
    },
  });

  // Update voice note mutation
  const updateVoiceNoteMutation = useMutation({
    mutationFn: async ({ noteId, transcript }: { noteId: string; transcript: string }) => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/voice-documentation/notes/${noteId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({ transcript }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update voice note: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: async (data, variables) => {
      setSuccessMessage("Changes saved successfully!");
      setShowSuccessModal(true);

      // Trigger UI refresh by updating the refresh trigger
      setRefreshTrigger((prev) => prev + 1);
      setEditDialogOpen(false);
    },
    onError: (err, variables) => {
      console.error("Voice note update failed:", err);
      console.error("Error details:", err.message);
      console.error("Error stack:", err.stack);
      toast({ 
        title: "Failed to save changes", 
        description: `Error: ${err.message}`,
        variant: "destructive" 
      });
    },
  });

  // Upload photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (data: {
      photo: File;
      patientId: string;
      type: string;
      description: string;
    }) => {
      const formData = new FormData();
      formData.append("photo", data.photo);
      formData.append("patientId", data.patientId);
      formData.append("type", data.type);
      formData.append("description", data.description);

      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/voice-documentation/photos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload photo");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/voice-documentation/photos"],
      });
      setSuccessMessage("Photo uploaded and analyzed");
      setShowSuccessModal(true);
    },
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `/api/voice-documentation/photos/${photoId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-Subdomain": getActiveSubdomain(),
          },
        },
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("404: Photo not found");
        }
        throw new Error("Failed to delete photo");
      }
      return response.json();
    },
    onSuccess: async (data, photoId) => {
      // Invalidate photos cache to refresh the list
      queryClient.invalidateQueries({
        queryKey: ["/api/voice-documentation/photos"],
      });

      setSuccessMessage("Photo deleted successfully!");
      setShowSuccessModal(true);
      console.log("Photo deleted from backend:", photoId);
    },
    onError: (err, photoId) => {
      toast({ title: "Failed to delete photo", variant: "destructive" });
      console.error("Error deleting photo:", err);
    },
  });

  // Mock data
  const mockVoiceNotes: VoiceNote[] = [
    {
      id: "note_1",
      patientId: "patient_1",
      patientName: "Sarah Johnson",
      providerId: "provider_1",
      providerName: "Dr. Emily Watson",
      type: "clinical_note",
      status: "completed",
      recordingDuration: 180,
      transcript:
        "Patient presents with chief complaint of chest pain. The pain started approximately 2 hours ago and is described as a sharp, stabbing sensation in the left side of the chest. Pain is exacerbated by deep inspiration and movement. No radiation to arm or jaw. Patient denies shortness of breath, nausea, or diaphoresis.",
      confidence: 94,
      medicalTerms: [
        { term: "chest pain", confidence: 98, category: "symptom" },
        { term: "sharp pain", confidence: 95, category: "symptom" },
        { term: "inspiration", confidence: 92, category: "anatomy" },
        { term: "diaphoresis", confidence: 97, category: "symptom" },
      ],
      structuredData: {
        chiefComplaint: "Chest pain",
        historyOfPresentIllness:
          "Patient presents with chest pain that started 2 hours ago, described as sharp and stabbing in the left chest, exacerbated by deep inspiration and movement.",
        physicalExam: "Pending examination",
        assessment: "Chest pain, likely musculoskeletal",
        plan: "Physical examination, ECG if indicated",
      },
      createdAt: "2024-06-26T14:30:00Z",
    },
    {
      id: "note_2",
      patientId: "patient_2",
      patientName: "Michael Chen",
      providerId: "provider_1",
      providerName: "Dr. Emily Watson",
      type: "procedure_note",
      status: "processing",
      recordingDuration: 240,
      transcript:
        "Procedure: Minor laceration repair. Patient sustained a 3-centimeter laceration to the left forearm after falling on broken glass...",
      confidence: 89,
      medicalTerms: [
        { term: "laceration", confidence: 96, category: "diagnosis" },
        { term: "forearm", confidence: 94, category: "anatomy" },
        { term: "suture", confidence: 91, category: "procedure" },
      ],
      createdAt: "2024-06-26T15:15:00Z",
    },
  ];

  const mockTemplates: SmartTemplate[] = [
    {
      id: "template_1",
      name: "SOAP Note",
      category: "soap_note",
      template:
        "SUBJECTIVE:\n{chief_complaint}\n\nOBJECTIVE:\n{physical_exam}\n\nASSESSMENT:\n{assessment}\n\nPLAN:\n{plan}",
      fields: [
        { name: "chief_complaint", type: "textarea", required: true },
        { name: "physical_exam", type: "textarea", required: true },
        { name: "assessment", type: "textarea", required: true },
        { name: "plan", type: "textarea", required: true },
      ],
      autoComplete: true,
      usageCount: 156,
    },
    {
      id: "template_2",
      name: "Procedure Note",
      category: "procedure",
      template:
        "PROCEDURE: {procedure_name}\n\nINDICATION: {indication}\n\nTECHNIQUE: {technique}\n\nCOMPLICATIONS: {complications}",
      fields: [
        { name: "procedure_name", type: "text", required: true },
        { name: "indication", type: "textarea", required: true },
        { name: "technique", type: "textarea", required: true },
        {
          name: "complications",
          type: "select",
          required: false,
          options: ["None", "Minor bleeding", "Infection"],
        },
      ],
      autoComplete: true,
      usageCount: 89,
    },
  ];

  const mockPhotos: ClinicalPhoto[] = [
    {
      id: "photo_1",
      patientId: "patient_1",
      patientName: "Sarah Johnson",
      type: "wound",
      filename: "wound_assessment_001.jpg",
      description: "Post-surgical wound healing assessment",
      url: "/api/photos/wound_assessment_001.jpg",
      dateTaken: "Jun 26, 18:45",
      annotations: [
        { x: 120, y: 80, width: 60, height: 40, label: "Healing edge" },
        { x: 200, y: 120, width: 30, height: 25, label: "Slight erythema" },
      ],
      aiAnalysis: {
        findings: [
          "Wound edges well-approximated",
          "Minimal erythema",
          "No signs of infection",
        ],
        confidence: 92,
        recommendations: [
          "Continue current wound care",
          "Monitor for signs of infection",
          "Follow-up in 5-7 days",
        ],
      },
      createdAt: "2024-06-26T13:45:00Z",
      metadata: {
        camera: "iPhone 14 Pro",
        resolution: "3024x4032",
        lighting: "Natural light",
      },
    },
  ];

  // Initialize local templates from mock data and localStorage
  useEffect(() => {
    const duplicatedTemplates = JSON.parse(
      localStorage.getItem("duplicatedTemplates") || "[]",
    );
    setLocalTemplates([...mockTemplates, ...duplicatedTemplates]);
    
    // Load saved language setting
    const savedLanguage = localStorage.getItem('voiceDocumentationLanguage');
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage);
    }
  }, []);

  // Recording timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // Don't automatically clear transcript - let users decide with Clear button
      console.log("Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      // Initialize speech recognition for real-time transcription
      if (
        "webkitSpeechRecognition" in window ||
        "SpeechRecognition" in window
      ) {
        const SpeechRecognition =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;
        speechRecognitionRef.current = new SpeechRecognition();
        speechRecognitionRef.current.continuous = true;
        speechRecognitionRef.current.interimResults = true;
        speechRecognitionRef.current.lang = selectedLanguage || localStorage.getItem('voiceDocumentationLanguage') || "en-US";

        speechRecognitionRef.current.onstart = () => {
          console.log("Speech recognition started");
        };

        speechRecognitionRef.current.onresult = (event: any) => {
          console.log("Speech recognition result:", event);
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          setCurrentTranscript((prev) => {
            const existingFinal = prev.split("[Speaking...]")[0];
            const newText = existingFinal + finalTranscript;
            return interimTranscript
              ? newText + "[Speaking...] " + interimTranscript
              : newText;
          });
        };

        speechRecognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          toast({
            title: `Speech recognition error: ${event.error}`,
            variant: "destructive",
          });
        };

        speechRecognitionRef.current.onend = () => {
          console.log("Speech recognition ended");
        };

        try {
          speechRecognitionRef.current.start();
          console.log("Speech recognition start requested");
        } catch (error) {
          console.error("Failed to start speech recognition:", error);
          toast({
            title: "Failed to start speech recognition",
            variant: "destructive",
          });
        }
      } else {
        console.warn("Speech recognition not supported in this browser");
        toast({
          title: "Speech recognition not supported in this browser",
          variant: "destructive",
        });
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Store audio for potential future use
        if (selectedPatient && selectedNoteType) {
          // Store audio URL for potential playback
          const tempNoteId = `temp_${Date.now()}`;
          setAudioStorage((prev) => new Map(prev.set(tempNoteId, audioUrl)));
        }

        stream.getTracks().forEach((track) => track.stop());

        // Don't clear transcript here - it should persist for the user to see
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      setSuccessMessage("Recording started");
      setShowSuccessModal(true);
    } catch (error) {
      toast({ title: "Failed to start recording", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop speech recognition
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }

      // Clean up interim transcript markers
      setCurrentTranscript((prev) =>
        prev.replace(/\[Speaking\.\.\.\]/g, "").trim(),
      );

      // Validate required fields
      if (!selectedPatient) {
        toast({
          title: "Please select a patient first",
          variant: "destructive",
        });
        return;
      }

      if (!selectedNoteType) {
        toast({
          title: "Please select a note type first",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Recording stopped",
        description: "Use 'Save Note' button to save your transcript",
      });
    }
  };

  const saveVoiceNote = () => {
    console.log("saveVoiceNote called");
    console.log("selectedPatient:", selectedPatient);
    console.log("selectedNoteType:", selectedNoteType);
    console.log("currentTranscript:", currentTranscript);

    if (!selectedPatient || !selectedNoteType) {
      toast({
        title: "Please select patient and note type",
        variant: "destructive",
      });
      return;
    }

    // Get the final transcript (without interim markers)
    const finalTranscript = currentTranscript
      .replace(/\[Speaking\.\.\.\]/g, "")
      .trim();

    console.log("finalTranscript:", finalTranscript);

    if (!finalTranscript) {
      toast({ title: "No transcript to save", variant: "destructive" });
      return;
    }

    console.log("Calling mutation with:", {
      patientId: selectedPatient,
      type: selectedNoteType,
      transcript: finalTranscript,
      duration: recordingTime,
      confidence: 95,
    });

    createVoiceNoteMutation.mutate({
      audioBlob: new Blob(),
      patientId: selectedPatient,
      type: selectedNoteType,
      transcript: finalTranscript,
      duration: recordingTime,
      confidence: 95,
    });
  };

  // Camera functions
  const startCamera = async () => {
    if (isStartingCamera || isCameraOpen) {
      console.log("Camera already starting or open, skipping...");
      return;
    }

    setIsStartingCamera(true);
    console.log("🎥 Starting camera access...");

    try {
      // Clean up any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Request camera access with simple config
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      console.log("✅ Camera access granted, stream obtained");
      streamRef.current = stream;

      // Set state immediately to show video element
      setIsCameraOpen(true);

      // Small delay to ensure React has rendered the video element
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          console.log("📹 Attaching stream to video element");
          const video = videoRef.current;

          // Simple stream assignment
          video.srcObject = streamRef.current;
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;

          // Try to play the video
          video
            .play()
            .then(() => {
              console.log("🎬 Video playing successfully");
              toast({
                title: "Camera started",
                description: "Position your camera and click Take Photo",
              });
            })
            .catch((err) => {
              console.error("Video play error:", err);
              // Video might still work even if play() fails in some browsers
            });
        } else {
          console.error("❌ Video element or stream not available");
        }
      }, 100);
    } catch (error) {
      console.error("Failed to access camera:", error);
      setIsCameraOpen(false);
      toast({
        title: "Camera access failed",
        description: "Please check camera permissions and try again",
        variant: "destructive",
      });
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = (caller?: string) => {
    console.log(
      "Stopping camera...",
      caller ? `Called by: ${caller}` : "Called from unknown location",
    );
    console.trace("stopCamera call stack");

    // Clean up stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clean up video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.oncanplay = null;
      videoRef.current.onpause = null;
      videoRef.current.onended = null;
      videoRef.current.onerror = null;
    }

    // Clear any pending timeouts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    setIsCameraOpen(false);
    setCapturedPhoto(null);
    setIsStartingCamera(false);
    toast({ title: "Camera stopped" });
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast({ title: "Camera not ready", variant: "destructive" });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      toast({ title: "Failed to capture photo", variant: "destructive" });
      return;
    }

    // Check if camera is actually running - with better validation
    if (!video.srcObject) {
      toast({
        title: "Camera not ready",
        description: "Please start the camera first",
        variant: "destructive",
      });
      return;
    }

    if (video.ended) {
      toast({
        title: "Camera stream ended",
        description: "Please restart the camera",
        variant: "destructive",
      });
      return;
    }

    // If video is paused, try to resume playback
    if (video.paused) {
      console.log("Video is paused, attempting to resume...");
      try {
        await video.play();
        console.log("Video resumed successfully");
      } catch (err) {
        console.error("Failed to resume video:", err);
        toast({
          title: "Camera playback issue",
          description: "Please restart the camera",
          variant: "destructive",
        });
        return;
      }
    }

    // Small delay to ensure video frame is stable
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Check video readiness
      if (!video.videoWidth || !video.videoHeight) {
        throw new Error("Video dimensions not available");
      }

      // Use actual video dimensions
      const width = video.videoWidth;
      const height = video.videoHeight;

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      console.log("Capturing with dimensions:", width, "x", height);

      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, width, height);

      // Convert canvas to data URL
      const photoDataUrl = canvas.toDataURL("image/jpeg", 0.8);

      console.log("Photo captured, data URL length:", photoDataUrl.length);

      setCapturedPhoto(photoDataUrl);

      // Keep camera running - don't stop it automatically
      // User can choose to take another photo or stop manually

      setSuccessMessage("Review your photo and choose to save, retake, or cancel.");
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Failed to capture photo:", error);
      toast({
        title: "Failed to capture photo",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Convert file to data URL for preview
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCapturedPhoto(dataUrl);

      setSuccessMessage("Photo loaded successfully. Fill in the details and save.");
      setShowSuccessModal(true);
    };
    fileReader.readAsDataURL(file);
  };

  const savePhoto = async () => {
    if (
      !capturedPhoto ||
      !selectedPhotoPatient ||
      !selectedPhotoType ||
      !photoDescription
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields before saving",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert data URL to blob
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();

      // Create a file from the blob
      const file = new File([blob], `clinical_photo_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Upload using the existing mutation
      uploadPhotoMutation.mutate({
        photo: file,
        patientId: selectedPhotoPatient,
        type: selectedPhotoType,
        description: photoDescription,
      });

      // Reset form and stop camera after successful save
      setCapturedPhoto(null);
      setSelectedPhotoPatient("");
      setSelectedPhotoType("");
      setPhotoDescription("");
      stopCamera("error-cleanup");

      // Switch to Clinical Photos tab to show the saved photo
      setActiveTab("photos");

      // Show success message
      setSuccessMessage("Your clinical photo has been saved to the Clinical Photos tab.");
      setShowSuccessModal(true);
    } catch (error) {
      toast({
        title: "Failed to save photo",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const playAudio = async (note: any) => {
    if (currentlyPlayingId === note.id && isPlaying) {
      // Stop current recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
      setSuccessMessage("Recording Stopped");
      setShowSuccessModal(true);
      return;
    }

    try {
      // Start recording audio when Play button is clicked
      setIsPlaying(true);
      setCurrentlyPlayingId(note.id);
      
      setSuccessMessage(`Recording audio for ${note.patientName}`);
      setShowSuccessModal(true);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const audioChunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        setIsPlaying(false);
        setCurrentlyPlayingId(null);

        if (audioChunks.length > 0) {
          // Create audio blob from recorded chunks
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          try {
            // Check if directory exists and create if needed
            await fetch('/api/voice-documentation/check-directory', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': getActiveSubdomain(),
              },
              credentials: 'include',
            });

            // Save recorded audio to server directory
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice_note.webm');
            formData.append('patientId', note.patientId);
            formData.append('noteId', note.id);

            const saveResponse = await fetch('/api/voice-documentation/audio', {
              method: 'POST',
              headers: {
                'X-Tenant-Subdomain': getActiveSubdomain(),
              },
              body: formData,
              credentials: 'include',
            });

            if (saveResponse.ok) {
              setSuccessMessage(`Audio recorded and saved for ${note.patientName}`);
              setShowSuccessModal(true);
              console.log('Recorded audio saved to uploads/VoiceNotes directory');
            } else {
              throw new Error('Failed to save recording');
            }
          } catch (saveError) {
            console.error('Error saving recorded audio:', saveError);
            toast({
              title: "Save Failed",
              description: "Could not save recorded audio",
              variant: "destructive",
            });
          }
        }
      };

      // Start recording
      recorder.start();
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
      toast({
        title: "Recording Failed",
        description: "Could not access microphone",
        variant: "destructive",
      });
      return;
    }

    // Keep the existing fallback logic for notes without recorded audio
    const audioUrl = audioStorage.get(note.id);

    if (audioUrl) {
      // Play actual recorded audio
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = audioUrl;
      audioRef.current.currentTime = 0;

      audioRef.current.onloadstart = () => {
        setIsPlaying(true);
        setCurrentlyPlayingId(note.id);
        setSuccessMessage(`Playing original recording for ${note.patientName}`);
        setShowSuccessModal(true);
      };

      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        setSuccessMessage("Playback Complete");
        setShowSuccessModal(true);
      };

      audioRef.current.onerror = () => {
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        toast({ title: "Audio Playback Error", variant: "destructive" });
      };

      audioRef.current.play().catch((error) => {
        console.error("Audio playback failed:", error);
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        toast({ title: "Failed to play audio", variant: "destructive" });
      });
    } else {
      // Fallback: Use text-to-speech for notes without recorded audio
      if (
        "speechSynthesis" in window &&
        note.transcript &&
        note.transcript !== "Processing audio..." &&
        note.transcript.trim() !== ""
      ) {
        // Stop any current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(note.transcript);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;

        utterance.onstart = () => {
          setIsPlaying(true);
          setCurrentlyPlayingId(note.id);
          setSuccessMessage(`Reading transcript for ${note.patientName}`);
          setShowSuccessModal(true);
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setCurrentlyPlayingId(null);
          setSuccessMessage("Playback Complete");
          setShowSuccessModal(true);
        };

        utterance.onerror = () => {
          setIsPlaying(false);
          setCurrentlyPlayingId(null);
          toast({ title: "Playback Error", variant: "destructive" });
        };

        window.speechSynthesis.speak(utterance);
      } else {
        // Final fallback: Create a brief audio tone
        try {
          const audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();

          // Resume context if suspended (required for some browsers)
          if (audioContext.state === "suspended") {
            audioContext.resume();
          }

          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 800;
          oscillator.type = "sine";

          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 2,
          );

          setIsPlaying(true);
          setCurrentlyPlayingId(note.id);
          setSuccessMessage("Audio recording not available - playing demo tone");
          setShowSuccessModal(true);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 2);

          oscillator.onended = () => {
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
            setSuccessMessage("Demo Playback Complete");
            setShowSuccessModal(true);
          };

          // Backup timeout in case onended doesn't fire
          setTimeout(() => {
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
          }, 2500);
        } catch (error) {
          console.error("Audio playback error:", error);
          setIsPlaying(false);
          setCurrentlyPlayingId(null);
          toast({
            title: "Audio Playback Failed",
            description: "Unable to play audio",
            variant: "destructive",
          });
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "recording":
        return "bg-red-100 text-red-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Voice Documentation
              </h1>
              <p className="text-gray-600 mt-1">
                AI-powered voice transcription and clinical photography
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Photo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Capture Clinical Photo</DialogTitle>
               
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      📝 <strong>Complete all fields below</strong> and
                      upload/capture a photo to enable the Save Photo button.
                    </p>
                  </div>
                  <div className="relative searchable-dropdown">
                    <label className="text-sm font-medium">Patient *</label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder={
                          patientsLoading
                            ? "Loading patients..."
                            : "Search patient..."
                        }
                        value={patientSearchTerm}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value);
                          setShowPatientDropdown(true);
                        }}
                        onFocus={() => setShowPatientDropdown(true)}
                        className="pr-8"
                      />
                      <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {showPatientDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {patientsLoading ? (
                          <div className="p-2 text-sm text-gray-500">
                            Loading...
                          </div>
                        ) : patients && patients.length > 0 ? (
                          (() => {
                            // Deduplicate patients by unique name combination
                            const uniquePatients = patients.filter(
                              (patient: any, index: number, array: any[]) =>
                                array.findIndex(
                                  (p: any) =>
                                    `${p.firstName} ${p.lastName}` ===
                                    `${patient.firstName} ${patient.lastName}`,
                                ) === index,
                            );

                            // Filter patients based on search term
                            const filteredPatients = uniquePatients.filter(
                              (patient: any) => {
                                const fullName =
                                  `${patient.firstName} ${patient.lastName}`.toLowerCase();
                                return fullName.includes(
                                  patientSearchTerm.toLowerCase(),
                                );
                              },
                            );

                            return filteredPatients.length > 0 ? (
                              filteredPatients.map((patient: any) => (
                                <div
                                  key={patient.id}
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-lg"
                                  onClick={() => {
                                    setSelectedPhotoPatient(
                                      patient.id.toString(),
                                    );
                                    setPatientSearchTerm(
                                      `${patient.firstName} ${patient.lastName}`,
                                    );
                                    setShowPatientDropdown(false);
                                  }}
                                >
                                  {patient.firstName} {patient.lastName}
                                </div>
                              ))
                            ) : (
                              <div className="p-2 text-sm text-gray-500">
                                No patients found
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-2 text-sm text-gray-500">
                            No patients found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="relative searchable-dropdown">
                    <label className="text-sm font-medium">Photo Type *</label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search photo type..."
                        value={photoTypeSearchTerm}
                        onChange={(e) => {
                          setPhotoTypeSearchTerm(e.target.value);
                          setShowPhotoTypeDropdown(true);
                        }}
                        onFocus={() => setShowPhotoTypeDropdown(true)}
                        className="pr-8"
                      />
                      <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {showPhotoTypeDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {(() => {
                          const photoTypes = [
                            { value: "wound", label: "Wound" },
                            { value: "rash", label: "Rash" },
                            { value: "procedure", label: "Procedure" },
                            { value: "general", label: "General" },
                          ];

                          // Filter photo types based on search term
                          const filteredTypes = photoTypes.filter((type) => {
                            return type.label
                              .toLowerCase()
                              .includes(photoTypeSearchTerm.toLowerCase());
                          });

                          return filteredTypes.length > 0 ? (
                            filteredTypes.map((type) => (
                              <div
                                key={type.value}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                                onClick={() => {
                                  setSelectedPhotoType(type.value);
                                  setPhotoTypeSearchTerm(type.label);
                                  setShowPhotoTypeDropdown(false);
                                }}
                              >
                                {type.label}
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">
                              No types found
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-md font-medium">Description *</label>
                    <Textarea
                      value={photoDescription}
                      onChange={(e) => setPhotoDescription(e.target.value)}
                      placeholder="Describe the clinical finding..."
                    />
                  </div>

                  {/* Camera Preview and Captured Photo */}
                  <div className="space-y-3">
                    {isCameraOpen && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Camera Preview
                        </label>
                        <div className="relative">
                          <video
                            ref={videoRef}
                            autoPlay={true}
                            playsInline={true}
                            muted={true}
                            controls={false}
                            width={640}
                            height={480}
                            className="w-full h-64 bg-black rounded-lg object-cover"
                            style={{
                              width: "100%",
                              height: "16rem",
                              backgroundColor: "#000000",
                              objectFit: "cover",
                              borderRadius: "0.5rem",
                              display: "block",
                            }}
                            onLoadStart={() =>
                              console.log("Video load started")
                            }
                            onLoadedData={() =>
                              console.log("Video data loaded")
                            }
                            onPlay={() => console.log("Video started playing")}
                            onError={(e) => console.error("Video error:", e)}
                          />
                          <div className="absolute bottom-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                            LIVE
                          </div>
                        </div>
                      </div>
                    )}

                    {capturedPhoto && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Captured Photo Preview
                        </label>
                        <img
                          src={capturedPhoto}
                          alt="Captured clinical photo"
                          className="w-full h-64 object-cover rounded-lg border"
                        />
                        <p className="text-xs text-gray-500 text-center">
                          Review your photo and choose an action below
                        </p>
                      </div>
                    )}

                    {/* Hidden canvas for photo capture */}
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!isCameraOpen && !capturedPhoto && (
                      <>
                        <Button
                          className="flex-1"
                          onClick={startCamera}
                          data-testid="button-start-camera"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Start Camera
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleFileUpload}
                          data-testid="button-upload-file"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload File
                        </Button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </>
                    )}

                    {isCameraOpen && !capturedPhoto && (
                      <>
                        <Button
                          className="flex-1"
                          onClick={capturePhoto}
                          data-testid="button-capture-photo"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Take Photo
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => stopCamera("stop-button")}
                          data-testid="button-stop-camera"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Stop Camera
                        </Button>
                      </>
                    )}

                    {capturedPhoto && (
                      <>
                        <Button
                          className="flex-1"
                          onClick={savePhoto}
                          disabled={
                            !selectedPhotoPatient ||
                            !selectedPhotoType ||
                            !photoDescription
                          }
                          data-testid="button-save-photo"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Photo
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setCapturedPhoto(null);
                            // Keep camera running for another shot if it was running
                          }}
                          data-testid="button-retake-photo"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Retake
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setCapturedPhoto(null);
                            stopCamera("error-cleanup");
                          }}
                          data-testid="button-cancel-photo"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => setVoiceSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Voice Settings
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="voice">Voice Notes</TabsTrigger>
            <TabsTrigger value="templates">Smart Templates</TabsTrigger>
            <TabsTrigger value="photos">Clinical Photos</TabsTrigger>
            <TabsTrigger value="coding">Medical Coding</TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="space-y-6">
            {/* Recording Interface */}
            <Card>
              <CardHeader>
                <CardTitle>Voice Recording</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center space-x-6">
                  <div className="text-center">
                    <div className="text-3xl font-mono mb-2">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isRecording ? "Recording..." : "Ready to record"}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={isRecording ? stopRecording : startRecording}
                    className="rounded-full w-16 h-16"
                  >
                    {isRecording ? (
                      <Square className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </Button>

                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={!isRecording}
                      onClick={() => {
                        if (isPaused) {
                          // Resume recording
                          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
                            mediaRecorderRef.current.resume();
                            if (speechRecognitionRef.current) {
                              try {
                                speechRecognitionRef.current.start();
                              } catch (e) {
                                console.error("Failed to resume speech recognition:", e);
                              }
                            }
                            setIsPaused(false);
                            toast({
                              title: "Recording resumed",
                              description: "Recording has been resumed",
                            });
                          }
                        } else {
                          // Pause recording
                          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            mediaRecorderRef.current.pause();
                            if (speechRecognitionRef.current) {
                              try {
                                speechRecognitionRef.current.stop();
                              } catch (e) {
                                console.error("Failed to pause speech recognition:", e);
                              }
                            }
                            setIsPaused(true);
                            toast({
                              title: "Recording paused",
                              description: "Recording has been paused",
                            });
                          }
                        }
                      }}
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      {isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        if (isRecording) {
                          stopRecording();
                        }
                        setCurrentTranscript("");
                        setRecordingTime(0);
                        setIsPaused(false);
                        if (audioChunksRef.current) {
                          audioChunksRef.current = [];
                        }
                        toast({
                          title: "Reset",
                          description: "Recording has been reset",
                        });
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-md font-medium">Patient</label>
                    <Select
                      value={selectedPatient}
                      onValueChange={setSelectedPatient}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            patientsLoading
                              ? "Loading patients..."
                              : "Select patient"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {patientsLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading...
                          </SelectItem>
                        ) : patients && patients.length > 0 ? (
                          (() => {
                            // Deduplicate patients by unique name combination
                            const uniquePatients = patients.filter(
                              (patient: any, index: number, array: any[]) =>
                                array.findIndex(
                                  (p: any) =>
                                    `${p.firstName} ${p.lastName}` ===
                                    `${patient.firstName} ${patient.lastName}`,
                                ) === index,
                            );
                            return uniquePatients.map((patient: any) => (
                              <SelectItem
                                key={patient.id}
                                value={patient.id.toString()}
                              >
                                {patient.firstName} {patient.lastName}
                              </SelectItem>
                            ));
                          })()
                        ) : (
                          <SelectItem value="no-patients" disabled>
                            No patients found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Note Type</label>
                    <Select
                      value={selectedNoteType}
                      onValueChange={setSelectedNoteType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinical_note">
                          Clinical Note
                        </SelectItem>
                        <SelectItem value="procedure_note">
                          Procedure Note
                        </SelectItem>
                        <SelectItem value="consultation">
                          Consultation
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Template</label>
                    <Select
                      value={selectedTemplate}
                      onValueChange={setSelectedTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Use template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="template_1">SOAP Note</SelectItem>
                        <SelectItem value="template_2">
                          Procedure Note
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Transcript Display Area */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isRecording ? (
                        <>
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-red-800 dark:text-red-400">
                            Live Transcription
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          Transcript
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={saveVoiceNote}
                        disabled={
                          !currentTranscript ||
                          !selectedPatient ||
                          !selectedNoteType ||
                          isRecording
                        }
                        style={{
                          backgroundColor:
                            !currentTranscript ||
                            !selectedPatient ||
                            !selectedNoteType ||
                            isRecording
                              ? "#CBD5E1"
                              : "#4A7DFF",
                          borderColor:
                            !currentTranscript ||
                            !selectedPatient ||
                            !selectedNoteType ||
                            isRecording
                              ? "#94A3B8"
                              : "#4A7DFF",
                          color:
                            !currentTranscript ||
                            !selectedPatient ||
                            !selectedNoteType ||
                            isRecording
                              ? "#475569"
                              : "white",
                          fontWeight: "700",
                          fontSize: "14px",
                          textShadow:
                            !currentTranscript ||
                            !selectedPatient ||
                            !selectedNoteType ||
                            isRecording
                              ? "none"
                              : "0 1px 2px rgba(0,0,0,0.3)",
                          border: `2px solid ${!currentTranscript || !selectedPatient || !selectedNoteType || isRecording ? "#94A3B8" : "#4A7DFF"}`,
                          opacity: 1,
                        }}
                        onMouseEnter={(e) => {
                          if (
                            !(
                              !currentTranscript ||
                              !selectedPatient ||
                              !selectedNoteType ||
                              isRecording
                            )
                          ) {
                            e.currentTarget.style.backgroundColor = "#7279FB";
                            e.currentTarget.style.borderColor = "#7279FB";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            !(
                              !currentTranscript ||
                              !selectedPatient ||
                              !selectedNoteType ||
                              isRecording
                            )
                          ) {
                            e.currentTarget.style.backgroundColor = "#4A7DFF";
                            e.currentTarget.style.borderColor = "#4A7DFF";
                          }
                        }}
                        className="transition-all duration-200 cursor-pointer"
                      >
                        <FileText
                          className="w-4 h-4 mr-1"
                          style={{
                            filter:
                              !currentTranscript ||
                              !selectedPatient ||
                              !selectedNoteType ||
                              isRecording
                                ? "none"
                                : "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
                            color:
                              !currentTranscript ||
                              !selectedPatient ||
                              !selectedNoteType ||
                              isRecording
                                ? "#475569"
                                : "white",
                          }}
                        />
                        Save Note
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentTranscript("")}
                        disabled={!currentTranscript}
                        style={{
                          backgroundColor: !currentTranscript
                            ? "#F1F5F9"
                            : "white",
                          borderColor: !currentTranscript
                            ? "#CBD5E1"
                            : "#6B7280",
                          color: !currentTranscript ? "#94A3B8" : "black",
                          fontWeight: "700",
                          fontSize: "14px",
                          border: `2px solid ${!currentTranscript ? "#CBD5E1" : "#6B7280"}`,
                          opacity: 1,
                        }}
                        className="transition-all duration-200 cursor-pointer"
                      >
                        <X
                          className="w-4 h-4 mr-1"
                          style={{
                            color: !currentTranscript ? "#94A3B8" : "black",
                          }}
                        />
                        Clear
                      </Button>
                    </div>
                  </div>
                  <textarea
                    value={currentTranscript}
                    onChange={(e) => setCurrentTranscript(e.target.value)}
                    placeholder={
                      isRecording
                        ? "Start speaking to see real-time transcription..."
                        : "Type your transcript here or start recording to capture speech automatically..."
                    }
                    className="w-full text-sm text-gray-700 dark:text-gray-200 min-h-[3rem] p-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded resize-none placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    rows={3}
                    disabled={isRecording}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Voice Notes List */}
            <div className="grid gap-4">
              {voiceNotes?.map((note) => (
                <Card key={note.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-gray-900 dark:text-gray-100">
                          {note.patientName}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(note.status)}>
                            {note.status}
                          </Badge>
                          <Badge variant="outline">
                            {note.type.replace("_", " ")}
                          </Badge>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatTime(note.recordingDuration)} •{" "}
                            {note.confidence}% confidence
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(note.createdAt), "MMM dd, HH:mm")}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">
                        Transcript
                      </h4>
                      <div className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-slate-800 p-3 rounded">
                        {note.transcript}
                      </div>
                    </div>

                    {note.medicalTerms.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">
                          Medical Terms Detected
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {note.medicalTerms.map((term, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {term.term} ({term.confidence}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {note.structuredData && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">
                          Structured Note
                        </h4>
                        <div className="space-y-2 text-sm">
                          {note.structuredData.chiefComplaint && (
                            <div>
                              <strong>Chief Complaint:</strong>{" "}
                              {note.structuredData.chiefComplaint}
                            </div>
                          )}
                          {note.structuredData.assessment && (
                            <div>
                              <strong>Assessment:</strong>{" "}
                              {note.structuredData.assessment}
                            </div>
                          )}
                          {note.structuredData.plan && (
                            <div>
                              <strong>Plan:</strong> {note.structuredData.plan}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => playAudio(note)}
                        disabled={currentlyPlayingId === note.id && isPlaying}
                      >
                        {currentlyPlayingId === note.id && isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-1" />
                            Playing...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Play
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingNote(note);
                          setEditedTranscript(note.transcript);
                          setEditDialogOpen(true);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Edit Note
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const textToCopy = note.transcript;
                          let copySuccess = false;

                          try {
                            // Method 1: Modern clipboard API
                            if (navigator.clipboard && window.isSecureContext) {
                              await navigator.clipboard.writeText(textToCopy);
                              copySuccess = true;
                            } else {
                              // Method 2: Fallback using textarea
                              const textArea =
                                document.createElement("textarea");
                              textArea.value = textToCopy;
                              textArea.style.position = "absolute";
                              textArea.style.left = "-9999px";
                              textArea.style.top = "0";
                              textArea.setAttribute("readonly", "");
                              document.body.appendChild(textArea);

                              // Select and copy
                              textArea.select();
                              textArea.setSelectionRange(0, textToCopy.length);

                              copySuccess = document.execCommand("copy");
                              document.body.removeChild(textArea);
                            }

                            if (copySuccess) {
                              setSuccessMessage(`${textToCopy.length} characters copied to clipboard`);
                              setShowSuccessModal(true);
                            } else {
                              throw new Error("Copy operation failed");
                            }
                          } catch (err) {
                            // Method 3: Manual selection fallback
                            const modal = document.createElement("div");
                            modal.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: white;
                            border: 2px solid #ccc;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                            z-index: 9999;
                            max-width: 80%;
                            max-height: 80%;
                          `;

                            const textarea = document.createElement("textarea");
                            textarea.value = textToCopy;
                            textarea.style.cssText = `
                            width: 100%;
                            height: 200px;
                            font-family: 'Figtree', monospace;
                            font-size: 12px;
                            border: 1px solid #ddd;
                            padding: 8px;
                          `;
                            textarea.select();

                            const closeBtn = document.createElement("button");
                            closeBtn.textContent = "Close";
                            closeBtn.style.cssText = `
                            margin-top: 10px;
                            padding: 8px 16px;
                            background: #007bff;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                          `;
                            closeBtn.onclick = () =>
                              document.body.removeChild(modal);

                            const title = document.createElement("div");
                            title.textContent =
                              "Select all text and copy (Ctrl+C):";
                            title.style.marginBottom = "10px";

                            modal.appendChild(title);
                            modal.appendChild(textarea);
                            modal.appendChild(closeBtn);
                            document.body.appendChild(modal);

                            toast({
                              title: "Manual Copy Required",
                              description:
                                "Please select all text and copy manually",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Text
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setVoiceNoteToDelete(note);
                          setVoiceNoteDeleteDialogOpen(true);
                        }}
                        disabled={deleteVoiceNoteMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4">
              {localTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {template.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            {template.category.replace("_", " ")}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Used {template.usageCount} times
                          </span>
                          {template.autoComplete && (
                            <Badge className="bg-blue-100 text-blue-800">
                              <Zap className="w-3 h-3 mr-1" />
                              Auto-complete
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Template Preview
                      </h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 p-3 rounded font-mono whitespace-pre-line">
                        {template.template}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Required Fields
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {template.fields.map((field, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {field.name} ({field.type})
                            {field.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">Use Template</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Use Template - {template.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-lg">
                              <h4 className="font-medium mb-2">
                                Template Information
                              </h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500">
                                    Category:
                                  </span>
                                  <span className="ml-2 capitalize">
                                    {template.category.replace("_", " ")}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">
                                    Usage Count:
                                  </span>
                                  <span className="ml-2">
                                    {template.usageCount} times
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">
                                Patient Selection
                              </label>
                              <Select>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      patientsLoading
                                        ? "Loading patients..."
                                        : "Select patient for this note"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {patientsLoading ? (
                                    <SelectItem value="loading" disabled>
                                      Loading...
                                    </SelectItem>
                                  ) : patients && patients.length > 0 ? (
                                    patients.map((patient: any) => (
                                      <SelectItem
                                        key={patient.id}
                                        value={patient.id.toString()}
                                      >
                                        {patient.firstName} {patient.lastName}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-patients" disabled>
                                      No patients found
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">
                                Template Fields
                              </label>
                              <div className="space-y-3">
                                {template.fields.map((field, idx) => (
                                  <div key={idx}>
                                    <label className="text-sm text-gray-700">
                                      {field.name}
                                      {field.required && (
                                        <span className="text-red-500 ml-1">
                                          *
                                        </span>
                                      )}
                                    </label>
                                    {field.type === "textarea" ? (
                                      <Textarea
                                        placeholder={`Enter ${field.name.toLowerCase()}`}
                                        className="mt-1"
                                      />
                                    ) : field.type === "select" &&
                                      field.options ? (
                                      <Select>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue
                                            placeholder={`Select ${field.name.toLowerCase()}`}
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {field.options.map(
                                            (option, optIdx) => (
                                              <SelectItem
                                                key={optIdx}
                                                value={option
                                                  .toLowerCase()
                                                  .replace(" ", "_")}
                                              >
                                                {option}
                                              </SelectItem>
                                            ),
                                          )}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        placeholder={`Enter ${field.name.toLowerCase()}`}
                                        className="mt-1"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">
                                Generated Note Preview
                              </label>
                              <div className="p-3 bg-gray-50 rounded-lg font-mono text-sm text-gray-700 max-h-40 overflow-y-auto">
                                {template.template}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button
                                onClick={() => {
                                  toast({
                                    title: "Template Applied",
                                    description: `${template.name} has been used to create a new voice note`,
                                  });
                                }}
                              >
                                Create Note from Template
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={editTemplateDialogOpen} onOpenChange={setEditTemplateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              // Initialize editing template with a deep copy
                              setEditingTemplate({
                                ...template,
                                fields: template.fields.map(f => ({ ...f }))
                              });
                              setEditTemplateDialogOpen(true);
                            }}
                          >
                            Edit Template
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Edit Template - {editingTemplate?.name || template.name}
                            </DialogTitle>
                          </DialogHeader>
                          {editingTemplate && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium mb-2 block">
                                    Template Name
                                  </label>
                                  <Input 
                                    value={editingTemplate.name}
                                    onChange={(e) => {
                                      setEditingTemplate({
                                        ...editingTemplate,
                                        name: e.target.value
                                      });
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium mb-2 block">
                                    Category
                                  </label>
                                  <Select 
                                    value={editingTemplate.category}
                                    onValueChange={(value) => {
                                      setEditingTemplate({
                                        ...editingTemplate,
                                        category: value as SmartTemplate['category']
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="soap_note">
                                        SOAP Note
                                      </SelectItem>
                                      <SelectItem value="procedure">
                                        Procedure
                                      </SelectItem>
                                      <SelectItem value="consultation">
                                        Consultation
                                      </SelectItem>
                                      <SelectItem value="discharge">
                                        Discharge
                                      </SelectItem>
                                      <SelectItem value="admission">
                                        Admission
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium mb-2 block">
                                  Template Content
                                </label>
                                <Textarea
                                  value={editingTemplate.template}
                                  onChange={(e) => {
                                    setEditingTemplate({
                                      ...editingTemplate,
                                      template: e.target.value
                                    });
                                  }}
                                  className="min-h-[200px] font-mono text-sm"
                                  placeholder="Enter template content with field placeholders like {chief_complaint}, {assessment}, etc."
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium">
                                    Template Fields
                                  </label>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      const newField = {
                                        name: `field_${editingTemplate.fields.length + 1}`,
                                        type: "text" as const,
                                        required: false
                                      };
                                      setEditingTemplate({
                                        ...editingTemplate,
                                        fields: [...editingTemplate.fields, newField]
                                      });
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Field
                                  </Button>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {editingTemplate.fields.map((field, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 p-2 border rounded"
                                    >
                                      <Input
                                        value={field.name}
                                        onChange={(e) => {
                                          const updatedFields = [...editingTemplate.fields];
                                          updatedFields[idx] = {
                                            ...updatedFields[idx],
                                            name: e.target.value
                                          };
                                          setEditingTemplate({
                                            ...editingTemplate,
                                            fields: updatedFields
                                          });
                                        }}
                                        className="flex-1"
                                        placeholder="Field name"
                                      />
                                      <Select 
                                        value={field.type}
                                        onValueChange={(value) => {
                                          const updatedFields = [...editingTemplate.fields];
                                          updatedFields[idx] = {
                                            ...updatedFields[idx],
                                            type: value as "text" | "select" | "textarea"
                                          };
                                          setEditingTemplate({
                                            ...editingTemplate,
                                            fields: updatedFields
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="w-32">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="text">
                                            Text
                                          </SelectItem>
                                          <SelectItem value="textarea">
                                            Textarea
                                          </SelectItem>
                                          <SelectItem value="select">
                                            Select
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const updatedFields = editingTemplate.fields.filter((_, i) => i !== idx);
                                          setEditingTemplate({
                                            ...editingTemplate,
                                            fields: updatedFields
                                          });
                                        }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id="autoComplete"
                                    checked={editingTemplate.autoComplete}
                                    onChange={(e) => {
                                      setEditingTemplate({
                                        ...editingTemplate,
                                        autoComplete: e.target.checked
                                      });
                                    }}
                                    className="rounded"
                                  />
                                  <label
                                    htmlFor="autoComplete"
                                    className="text-sm"
                                  >
                                    Enable auto-complete
                                  </label>
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-4">
                                <DialogClose asChild>
                                  <Button 
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTemplate(null);
                                      setEditTemplateDialogOpen(false);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </DialogClose>
                                <Button
                                  onClick={() => {
                                    // Update the template in localTemplates
                                    setLocalTemplates((prev) => {
                                      const updated = prev.map((t) =>
                                        t.id === template.id ? editingTemplate : t
                                      );
                                      return updated;
                                    });
                                    
                                    // Also update in localStorage if needed
                                    try {
                                      const existingTemplates = JSON.parse(
                                        localStorage.getItem("duplicatedTemplates") || "[]"
                                      );
                                      const updatedTemplates = existingTemplates.map((t: SmartTemplate) =>
                                        t.id === template.id ? editingTemplate : t
                                      );
                                      localStorage.setItem(
                                        "duplicatedTemplates",
                                        JSON.stringify(updatedTemplates)
                                      );
                                    } catch (error) {
                                      console.error("Error updating localStorage:", error);
                                    }
                                    
                                    toast({
                                      title: "Template Updated",
                                      description: `${editingTemplate.name} has been successfully updated`,
                                    });
                                    
                                    setEditingTemplate(null);
                                    setEditTemplateDialogOpen(false);
                                  }}
                                >
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            const timestamp = Date.now();
                            const duplicatedTemplate: SmartTemplate = {
                              ...template,
                              id: `template_copy_${timestamp}`,
                              name: `${template.name} (Copy)`,
                              usageCount: 0,
                            };

                            console.log(
                              "Creating duplicated template:",
                              duplicatedTemplate,
                            );

                            // Add the duplicated template to the local state immediately
                            setLocalTemplates((prev) => {
                              const newTemplates = [
                                ...prev,
                                duplicatedTemplate,
                              ];
                              console.log(
                                "Updated templates list:",
                                newTemplates.length,
                              );
                              return newTemplates;
                            });

                            // Store in localStorage for persistence
                            try {
                              const existingTemplates = JSON.parse(
                                localStorage.getItem("duplicatedTemplates") ||
                                  "[]",
                              );
                              existingTemplates.push(duplicatedTemplate);
                              localStorage.setItem(
                                "duplicatedTemplates",
                                JSON.stringify(existingTemplates),
                              );
                              console.log(
                                "Saved to localStorage:",
                                existingTemplates.length,
                              );
                            } catch (storageError) {
                              console.error(
                                "localStorage error:",
                                storageError,
                              );
                            }

                            // Force re-render by updating a different state
                            setActiveTab((prev) =>
                              prev === "templates" ? "templates" : "templates",
                            );

                            toast({
                              title: "Template Successfully Duplicated",
                              description: `"${duplicatedTemplate.name}" has been created and added to your templates list. Scroll down to see it.`,
                            });
                          } catch (error) {
                            console.error("Duplication error:", error);
                            toast({
                              title: "Duplication Failed",
                              description:
                                "There was an error duplicating the template. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Duplicate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="photos" className="space-y-4">
            <div className="grid gap-4">
              {photosLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    Loading clinical photos...
                  </p>
                </div>
              ) : photos && photos.length > 0 ? (
                photos.map((photo) => (
                  <Card key={photo.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {photo.patientName}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{photo.type}</Badge>
                            <button
                              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                              onClick={() => {
                                setSelectedPhoto(photo);
                                setViewFullDialogOpen(true);
                              }}
                              data-testid={`button-view-photo-${photo.id}`}
                            >
                              {photo.filename}
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(photo.createdAt), "MMM dd, HH:mm")}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium text-md mb-2">
                          Description
                        </h4>
                        <p className="text-sm text-gray-700">
                          {photo.description}
                        </p>
                      </div>

                      {photo.aiAnalysis && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">
                            AI Analysis ({photo.aiAnalysis?.confidence || 0}%
                            confidence)
                          </h4>
                          <div className="space-y-2">
                            <div>
                              <strong className="text-xs">Findings:</strong>
                              <ul className="text-sm list-disc list-inside mt-1">
                                {photo.aiAnalysis?.findings?.map(
                                  (finding, idx) => (
                                    <li key={idx}>{finding}</li>
                                  ),
                                ) || (
                                  <li className="text-gray-500">
                                    No findings available
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div>
                              <strong className="text-xs">
                                Recommendations:
                              </strong>
                              <ul className="text-sm list-disc list-inside mt-1">
                                {photo.aiAnalysis.recommendations.map(
                                  (rec, idx) => (
                                    <li key={idx}>{rec}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium text-md mb-2">Metadata</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Camera:</span>{" "}
                            {photo.metadata.camera}
                          </div>
                          <div>
                            <span className="text-gray-500">Resolution:</span>{" "}
                            {photo.metadata.resolution}
                          </div>
                          <div>
                            <span className="text-gray-500">Lighting:</span>{" "}
                            {photo.metadata.lighting}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setViewFullDialogOpen(true);
                          }}
                        >
                          <Maximize className="w-4 h-4 mr-1" />
                          View Full
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Create a download link for the photo
                            const link = document.createElement("a");
                            link.href = photo.url;
                            // Extract the correct file extension from the original filename
                            const fileExtension = photo.filename.split('.').pop() || 'png';
                            const cleanPatientName = photo.patientName.replace(/\s+/g, '_');
                            link.download = `${cleanPatientName}_${photo.type}_${photo.filename}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);

                            toast({
                              title: "Download Started",
                              description: `Downloading ${photo.filename} for ${photo.patientName}`,
                            });
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setAnnotateDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setAddToReportDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add to Report
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setPhotoToDelete(photo);
                            setDeleteConfirmDialogOpen(true);
                          }}
                          disabled={deletePhotoMutation.isPending}
                        >
                          <Trash className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No clinical photos yet
                  </h3>
                  <p className="text-muted-foreground">
                    Capture your first clinical photo using the "Capture Photo"
                    button above.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="coding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Medical Coding Assistant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  AI-powered ICD-10 and CPT code suggestions based on clinical
                  documentation.
                </p>
                <Button
                  onClick={() => {
                    // Simulate analysis process
                    const analysisData = {
                      suggestedCodes: [
                        {
                          type: "ICD-10",
                          code: "R06.02",
                          description: "Shortness of breath",
                          confidence: 94,
                          source: "Patient presents with dyspnea on exertion",
                        },
                        {
                          type: "ICD-10",
                          code: "Z51.11",
                          description:
                            "Encounter for antineoplastic chemotherapy",
                          confidence: 89,
                          source: "Follow-up appointment for treatment",
                        },
                        {
                          type: "CPT",
                          code: "99213",
                          description:
                            "Office/outpatient visit, established patient",
                          confidence: 96,
                          source: "15-minute consultation visit",
                        },
                        {
                          type: "CPT",
                          code: "71045",
                          description: "Chest X-ray, single view",
                          confidence: 85,
                          source: "Imaging ordered for respiratory evaluation",
                        },
                      ],
                      totalDocuments: 3,
                      analysisTime: "2.3 seconds",
                      confidence: 91,
                    };

                    setAnalysisResults(analysisData);
                    setAnalyzeDialogOpen(true);

                    toast({
                      title: "Documentation Analysis Complete",
                      description: `Found ${analysisData.suggestedCodes.length} relevant medical codes with ${analysisData.confidence}% confidence`,
                    });
                  }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Analyze Documentation
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Note Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Edit Voice Note - {editingNote?.patientName}
              </DialogTitle>
            </DialogHeader>
            {editingNote && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Patient
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {editingNote.patientName}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Provider
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {editingNote.providerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Note Type
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {editingNote.type.replace("_", " ")}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Recording Duration
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {Math.floor(editingNote.recordingDuration / 60)}:
                      {(editingNote.recordingDuration % 60)
                        .toString()
                        .padStart(2, "0")}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Original Transcript
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                    {editingNote.transcript}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Edited Transcript
                  </label>
                  <Textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Edit the transcript here..."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editedTranscript.length} characters
                  </div>
                </div>

                {editingNote.medicalTerms &&
                  editingNote.medicalTerms.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Medical Terms Detected
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {editingNote.medicalTerms.map((term, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {term.term} ({term.confidence}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {editingNote.structuredData && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Structured Clinical Data
                    </label>
                    <div className="grid grid-cols-1 gap-3 p-4 bg-blue-50 rounded-lg">
                      <div>
                        <strong className="text-sm">Chief Complaint:</strong>
                        <p className="text-sm mt-1">
                          {editingNote.structuredData.chiefComplaint}
                        </p>
                      </div>
                      <div>
                        <strong className="text-sm">History:</strong>
                        <p className="text-sm mt-1">
                          {editingNote.structuredData.historyOfPresentIllness}
                        </p>
                      </div>
                      <div>
                        <strong className="text-sm">Assessment:</strong>
                        <p className="text-sm mt-1">
                          {editingNote.structuredData.assessment}
                        </p>
                      </div>
                      <div>
                        <strong className="text-sm">Plan:</strong>
                        <p className="text-sm mt-1">
                          {editingNote.structuredData.plan}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div className="text-sm">
                    <strong className="text-yellow-800">Note:</strong>
                    <span className="text-yellow-700 ml-1">
                      Editing this transcript will require re-analysis for
                      medical terms and structured data extraction.
                    </span>
                  </div>
                </div>

                <div className="flex justify-between gap-3 pt-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(editedTranscript);
                        toast({
                          title: "Text Copied",
                          description: "Edited transcript copied to clipboard",
                        });
                      }}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditedTranscript(editingNote.transcript)
                      }
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (editingNote && editedTranscript.trim()) {
                          updateVoiceNoteMutation.mutate({
                            noteId: editingNote.id,
                            transcript: editedTranscript.trim()
                          });
                        } else {
                          toast({
                            title: "Invalid Input",
                            description: "Please enter a valid transcript",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={updateVoiceNoteMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Full Photo Dialog */}
        <Dialog open={viewFullDialogOpen} onOpenChange={setViewFullDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {selectedPhoto?.filename} - {selectedPhoto?.patientName}
              </DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.description}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Patient
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedPhoto.patientName}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Type
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {selectedPhoto.type.replace("_", " ")}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Date Taken
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedPhoto.dateTaken}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      AI Analysis
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedPhoto.aiAnalysis?.findings?.join(", ") ||
                        "No findings available"}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setViewFullDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = selectedPhoto.url;
                      link.download = `${selectedPhoto.filename}_full_res.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      toast({
                        title: "Download Started",
                        description: "Full resolution image download started",
                      });
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Full Resolution
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Annotate Photo Dialog */}
        <Dialog open={annotateDialogOpen} onOpenChange={setAnnotateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Annotate Photo - {selectedPhoto?.filename}
              </DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <img
                      src={selectedPhoto.url}
                      alt={selectedPhoto.description}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Clinical Notes
                      </label>
                      <Textarea
                        placeholder="Add clinical observations, measurements, or notes about this image..."
                        className="min-h-[100px]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Annotation Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Normal",
                          "Abnormal",
                          "Requires Follow-up",
                          "Urgent",
                          "Baseline",
                        ].map((tag) => (
                          <Button key={tag} size="sm" variant="outline">
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Detailed Description
                  </label>
                  <Textarea
                    placeholder="Provide detailed description of findings, measurements, or clinical significance..."
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAnnotateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Annotations Saved",
                        description: `Clinical annotations added to ${selectedPhoto.filename}`,
                      });
                      setAnnotateDialogOpen(false);
                    }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Annotations
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add to Report Dialog */}
        <Dialog
          open={addToReportDialogOpen}
          onOpenChange={setAddToReportDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Add Photo to Report - {selectedPhoto?.filename}
              </DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.description}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Patient
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedPhoto.patientName}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Photo Type</div>
                      <div className="font-medium capitalize">
                        {selectedPhoto.type.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Select Report Type
                  </label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">
                        Consultation Report
                      </SelectItem>
                      <SelectItem value="progress">Progress Note</SelectItem>
                      <SelectItem value="discharge">
                        Discharge Summary
                      </SelectItem>
                      <SelectItem value="surgical">Surgical Report</SelectItem>
                      <SelectItem value="diagnostic">
                        Diagnostic Report
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Caption for Report
                  </label>
                  <Textarea
                    placeholder="Enter caption that will appear with the image in the report..."
                    defaultValue={selectedPhoto.description}
                    className="min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Image Position in Report
                  </label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline">Inline with text</SelectItem>
                      <SelectItem value="appendix">Appendix</SelectItem>
                      <SelectItem value="cover">Cover page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAddToReportDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Photo Added to Report",
                        description: `${selectedPhoto.filename} has been added to the selected report`,
                      });
                      setAddToReportDialogOpen(false);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Report
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Analyze Documentation Dialog */}
        <Dialog open={analyzeDialogOpen} onOpenChange={setAnalyzeDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Medical Coding Analysis Results</DialogTitle>
            </DialogHeader>
            {analysisResults && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {analysisResults.suggestedCodes.length}
                    </div>
                    <div className="text-sm text-gray-600">Suggested Codes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analysisResults.confidence}%
                    </div>
                    <div className="text-sm text-gray-600">Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {analysisResults.analysisTime}
                    </div>
                    <div className="text-sm text-gray-600">Analysis Time</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Suggested Medical Codes
                  </h3>
                  <div className="space-y-3">
                    {analysisResults.suggestedCodes.map(
                      (code: any, index: number) => (
                        <Card key={index} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge
                                  variant={
                                    code.type === "ICD-10"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {code.type}
                                </Badge>
                                <span className="font-mono text-lg font-bold">
                                  {code.code}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-green-600 border-green-600"
                                >
                                  {code.confidence}% confidence
                                </Badge>
                              </div>
                              <h4 className="font-medium text-gray-900 mb-1">
                                {code.description}
                              </h4>
                              <p className="text-sm text-gray-600">
                                <strong>Source:</strong> {code.source}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button size="sm" variant="outline">
                                <Copy className="w-4 h-4 mr-1" />
                                Copy Code
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => {
                                  // Navigate to billing page with the code pre-filled
                                  const billingCode = code.code;
                                  const billingDescription = code.description || code.code;
                                  const billingUrl = `/billing?addCode=${encodeURIComponent(billingCode)}&description=${encodeURIComponent(billingDescription)}`;
                                  window.location.href = billingUrl;
                                  toast({
                                    title: "Code Added",
                                    description: `${billingCode} has been added to billing`,
                                  });
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add to Billing
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ),
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">
                    Analysis Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">
                        Documents Analyzed:
                      </span>
                      <span className="ml-2">
                        {analysisResults.totalDocuments} clinical notes
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Code Types Found:
                      </span>
                      <span className="ml-2">ICD-10, CPT</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <strong className="text-yellow-800">Important:</strong>
                        <span className="text-yellow-700 ml-1">
                          AI-generated codes require clinical validation. Please
                          review all suggestions with appropriate medical
                          documentation and coding guidelines.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAnalyzeDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Codes Exported",
                        description:
                          "Medical codes have been exported to billing system",
                      });
                      setAnalyzeDialogOpen(false);
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export All Codes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Voice Settings Dialog */}
        <Dialog open={voiceSettingsOpen} onOpenChange={setVoiceSettingsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Voice Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recording Settings</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Audio Quality
                        </label>
                        <p className="text-xs text-gray-500">
                          Higher quality uses more storage
                        </p>
                      </div>
                      <Select defaultValue="high">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low (8kHz)</SelectItem>
                          <SelectItem value="medium">Medium (16kHz)</SelectItem>
                          <SelectItem value="high">High (44kHz)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Auto-save recordings
                        </label>
                        <p className="text-xs text-gray-500">
                          Automatically save completed recordings
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Enabled
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Background noise reduction
                        </label>
                        <p className="text-xs text-gray-500">
                          Filter out ambient noise during recording
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Enabled
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Transcription Settings
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Language</label>
                        <p className="text-xs text-gray-500">
                          Primary language for transcription
                        </p>
                      </div>
                      <Select 
                        value={selectedLanguage}
                        onValueChange={(value) => setSelectedLanguage(value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="en-UK">English (UK)</SelectItem>
                          <SelectItem value="es-ES">Spanish</SelectItem>
                          <SelectItem value="fr-FR">French</SelectItem>
                          <SelectItem value="de-DE">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Medical terminology enhancement
                        </label>
                        <p className="text-xs text-gray-500">
                          Improved recognition of medical terms
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Enabled
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Real-time transcription
                        </label>
                        <p className="text-xs text-gray-500">
                          Show transcription while recording
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Enabled
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Confidence threshold
                        </label>
                        <p className="text-xs text-gray-500">
                          Minimum confidence for auto-approval
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">85%</span>
                        <div className="w-20 h-2 bg-gray-200 rounded-full">
                          <div className="w-4/5 h-full bg-blue-500 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Security & Privacy</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Encrypt recordings
                        </label>
                        <p className="text-xs text-gray-500">
                          End-to-end encryption for all audio files
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Enabled
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">
                          Auto-delete recordings
                        </label>
                        <p className="text-xs text-gray-500">
                          Delete audio after successful transcription
                        </p>
                      </div>
                      <Select defaultValue="30days">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="7days">7 days</SelectItem>
                          <SelectItem value="30days">30 days</SelectItem>
                          <SelectItem value="90days">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setVoiceSettingsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Save language setting to localStorage
                    localStorage.setItem('voiceDocumentationLanguage', selectedLanguage);
                    
                    // Update speech recognition language if it's running
                    if (speechRecognitionRef.current) {
                      speechRecognitionRef.current.lang = selectedLanguage;
                    }
                    
                    toast({
                      title: "Settings Saved",
                      description:
                        "Voice settings have been updated successfully",
                    });
                    setVoiceSettingsOpen(false);
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            {photoToDelete && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this photo for <strong>{photoToDelete.patientName}</strong>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteConfirmDialogOpen(false);
                      setPhotoToDelete(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (photoToDelete) {
                        deletePhotoMutation.mutate(photoToDelete.id);
                        setDeleteConfirmDialogOpen(false);
                        setPhotoToDelete(null);
                      }
                    }}
                    disabled={deletePhotoMutation.isPending}
                  >
                    OK
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Voice Note Delete Confirmation AlertDialog */}
        <AlertDialog open={voiceNoteDeleteDialogOpen} onOpenChange={setVoiceNoteDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogDescription>
                {voiceNoteToDelete && (
                  <>
                    Are you sure you want to delete this voice note for{" "}
                    <strong>{voiceNoteToDelete.patientName}</strong>?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => {
                  setVoiceNoteDeleteDialogOpen(false);
                  setVoiceNoteToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (voiceNoteToDelete) {
                    deleteVoiceNoteMutation.mutate(voiceNoteToDelete.id);
                    setVoiceNoteDeleteDialogOpen(false);
                    setVoiceNoteToDelete(null);
                  }
                }}
                disabled={deleteVoiceNoteMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-green-600">Success</DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-gray-700">{successMessage}</p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage("");
                }}
              >
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
