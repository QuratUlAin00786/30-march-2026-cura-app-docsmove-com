import React, { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { isDoctorLike } from "@/lib/role-utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { 
  Receipt, 
  Plus, 
  Search, 
  DollarSign,
  PoundSterling, 
  CreditCard, 
  FileText, 
  Calendar,
  CalendarDays,
  User,
  Download,
  Eye,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  BarChart3,
  TrendingUp,
  Filter,
  PieChart,
  FileBarChart,
  Target,
  Edit,
  LayoutGrid,
  List,
  Loader2
} from "lucide-react";
import { SearchComboBox } from "@/components/SearchComboBox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

interface Invoice {
  id: number;
  organizationId: number;
  invoiceNumber?: string;
  patientId: string;
  patientName: string;
  dateOfService: string;
  invoiceDate: string;
  dueDate: string;
  status: 'unpaid' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    amount?: number;
  }>;
  insurance?: {
    provider: string;
    claimNumber: string;
    status: 'pending' | 'approved' | 'denied' | 'partially_paid';
    paidAmount: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    method: 'cash' | 'card' | 'bank_transfer' | 'insurance';
    date: string;
    reference?: string;
  }>;
}

type ServiceType = "appointments" | "labResults" | "imaging" | "other";

interface LineItem {
  id: string;
  serviceType: ServiceType;
  serviceId?: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  readOnlyPrice?: boolean;
  providerName?: string; // Display name of the provider/doctor
  doctorId?: number; // ID of the provider/doctor for saving to invoice
}

const DOCTOR_SERVICE_OPTIONS = [
  { value: "General Consultation", description: "Standard visit for diagnosis or follow-up" },
  { value: "Specialist Consultation", description: "Visit with a specialist doctor (e.g., Cardiologist)" },
  { value: "Follow-up Visit", description: "Follow-up within a certain time period" },
  { value: "Teleconsultation", description: "Online or phone consultation" },
  { value: "Emergency Visit", description: "Immediate or off-hours consultation" },
  { value: "Home Visit", description: "Doctor visits patient's home" },
  { value: "Procedure Consultation", description: "Pre- or post-surgery consultation" }
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" }
];

const LAB_TEST_OPTIONS = [
  "Complete Blood Count (CBC)",
  "Basic Metabolic Panel (BMP) / Chem-7",
  "Comprehensive Metabolic Panel (CMP)",
  "Lipid Profile (Cholesterol, LDL, HDL, Triglycerides)",
  "Thyroid Function Tests (TSH, Free T4, Free T3)",
  "Liver Function Tests (AST, ALT, ALP, Bilirubin)",
  "Kidney Function Tests (Creatinine, BUN, eGFR)",
  "Electrolytes (Sodium, Potassium, Chloride, Bicarbonate)",
  "Blood Glucose (Fasting / Random / Postprandial)",
  "Hemoglobin A1C (HbA1c)",
  "C-Reactive Protein (CRP)",
  "Erythrocyte Sedimentation Rate (ESR)",
  "Coagulation Tests (PT, PTT, INR)",
  "Urinalysis (UA)",
  "Albumin / Total Protein",
  "Iron Studies (Serum Iron, TIBC, Ferritin)",
  "Vitamin D",
  "Vitamin B12 / Folate",
  "Hormone Panels (e.g., LH, FSH, Testosterone, Estrogen)",
  "Prostate-Specific Antigen (PSA)",
  "Thyroid Antibodies (e.g. Anti-TPO, Anti-TG)",
  "Creatine Kinase (CK)",
  "Cardiac Biomarkers (Troponin, CK-MB, BNP)",
  "Electrolyte Panel",
  "Uric Acid",
  "Lipase / Amylase (Pancreatic enzymes)",
  "Hepatitis B / C Serologies",
  "HIV Antibody / Viral Load",
  "HCG (Pregnancy / Quantitative)",
  "Autoimmune Panels (ANA, ENA, Rheumatoid Factor)",
  "Tumor Markers (e.g. CA-125, CEA, AFP)",
  "Blood Culture & Sensitivity",
  "Stool Culture / Ova & Parasites",
  "Sputum Culture",
  "Viral Panels / PCR Tests (e.g. COVID-19, Influenza)",
  "Hormonal tests (Cortisol, ACTH)"
];

const IMAGING_TYPE_OPTIONS = [
  "X-ray (Radiography)",
  "CT (Computed Tomography)",
  "MRI (Magnetic Resonance Imaging)",
  "Ultrasound (Sonography)",
  "Mammography",
  "Fluoroscopy",
  "PET (Positron Emission Tomography)",
  "SPECT (Single Photon Emission CT)",
  "Nuclear Medicine Scans",
  "DEXA (Bone Densitometry)",
  "Angiography",
  "Interventional Radiology (IR)"
];

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  appointments: "Appointments",
  labResults: "Lab Results",
  imaging: "Imaging",
  other: "Other"
};

async function fetchResource<T = any>(path: string): Promise<T> {
  const response = await apiRequest("GET", path);
  return response.json();
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
};

function PricingManagementDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const [pricingTab, setPricingTab] = useState("doctors");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingDefaultFees, setIsAddingDefaultFees] = useState(false);
  const [showDefaultFeesSuccessModal, setShowDefaultFeesSuccessModal] = useState(false);
  const [defaultFeesSuccessMessage, setDefaultFeesSuccessMessage] = useState({ title: "", description: "" });
  const [multipleServices, setMultipleServices] = useState<any[]>([
    { serviceName: "", serviceCode: "", category: "", basePrice: "" }
  ]);

  // Default Doctor Fees
  const DEFAULT_DOCTOR_FEES = [
    { serviceName: "Emergency Visit", serviceCode: "EV001", category: "Immediate or off-hours consultation", basePrice: "150.00" },
    { serviceName: "Follow-up Visit", serviceCode: "FV001", category: "Follow-up within a certain time period", basePrice: "30.00" },
    { serviceName: "General Consultation", serviceCode: "GC001", category: "Standard visit for diagnosis or follow-up", basePrice: "50.00" },
    { serviceName: "Home Visit", serviceCode: "HV001", category: "Doctor visits patient's home", basePrice: "100.00" },
    { serviceName: "Injection Anesthesia", serviceCode: "IA001", category: "Pre- or post-surgery consultation", basePrice: "50.00" },
    { serviceName: "Specialist Consultation", serviceCode: "SC001", category: "Visit with a specialist doctor (e.g., Cardiologist)", basePrice: "120.00" },
    { serviceName: "Teleconsultation", serviceCode: "TC001", category: "Online or phone consultation", basePrice: "40.00" }
  ];
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const [showDoctorSuggestions, setShowDoctorSuggestions] = useState(false);
  const [showLabTestSuggestions, setShowLabTestSuggestions] = useState(false);
  const [showLabRoleSuggestions, setShowLabRoleSuggestions] = useState(false);
  const [showLabDoctorSuggestions, setShowLabDoctorSuggestions] = useState(false);
  const [showImagingTypeSuggestions, setShowImagingTypeSuggestions] = useState(false);
  const [showTreatmentRoleSuggestions, setShowTreatmentRoleSuggestions] = useState(false);
  const [showTreatmentDoctorSuggestions, setShowTreatmentDoctorSuggestions] = useState(false);
  const [skipRoleSuggestionFocus, setSkipRoleSuggestionFocus] = useState(false);
  const [labTestFilter, setLabTestFilter] = useState("");
  const [labDoctorFilter, setLabDoctorFilter] = useState("");
  const [doctorFeeServiceFilter, setDoctorFeeServiceFilter] = useState("");
  const [doctorFeeDoctorFilter, setDoctorFeeDoctorFilter] = useState("");
  const [defaultTestsAdded, setDefaultTestsAdded] = useState(false);
  const [isAddingDefaultTests, setIsAddingDefaultTests] = useState(false);
  const [isAddingDefaultImaging, setIsAddingDefaultImaging] = useState(false);
  const [showImagingExistsModal, setShowImagingExistsModal] = useState(false);
  const [showTestsExistsModal, setShowTestsExistsModal] = useState(false);
  const [showDeleteAllImagingDialog, setShowDeleteAllImagingDialog] = useState(false);
  const [isDeletingAllImaging, setIsDeletingAllImaging] = useState(false);
  const [currentlyDeletingImaging, setCurrentlyDeletingImaging] = useState<string>("");
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const [duplicateServiceNames, setDuplicateServiceNames] = useState<string[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  
  // Validation error states
  const [doctorRoleError, setDoctorRoleError] = useState("");
  const [doctorNameError, setDoctorNameError] = useState("");
  const [labTestError, setLabTestError] = useState("");
  const [imagingError, setImagingError] = useState("");
  const [showTreatmentsInfoModal, setShowTreatmentsInfoModal] = useState(false);
  const [editingTreatmentInfo, setEditingTreatmentInfo] = useState<any>(null);
  const [newTreatmentInfo, setNewTreatmentInfo] = useState({ name: "", colorCode: "#2563eb" });
  const [isSavingTreatmentInfo, setIsSavingTreatmentInfo] = useState(false);
  const [showAddTreatmentDialog, setShowAddTreatmentDialog] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    name: "",
    basePrice: "",
    colorCode: "#000000",
    doctorRole: "",
    doctorName: "",
    doctorId: null as number | null,
    treatmentInfoId: ""
  });
  const [treatmentError, setTreatmentError] = useState("");
  const [isSavingTreatment, setIsSavingTreatment] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<any>(null);

  const closeTreatmentsInfoModal = () => {
    setShowTreatmentsInfoModal(false);
    setEditingTreatmentInfo(null);
    setNewTreatmentInfo({ name: "", colorCode: "#2563eb" });
  };

  const openTreatmentsInfoModalForCreate = () => {
    setEditingTreatmentInfo(null);
    setNewTreatmentInfo({ name: "", colorCode: "#2563eb" });
    setShowTreatmentsInfoModal(true);
  };

  const openTreatmentsInfoModalForEdit = (info: any) => {
    setEditingTreatmentInfo(info);
    setNewTreatmentInfo({
      name: info.name || "",
      colorCode: info.colorCode || "#2563eb"
    });
    setShowTreatmentsInfoModal(true);
  };

  const invalidateTreatmentsInfoCache = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/treatments-info"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pricing/treatments"] });
  };

  const createTreatmentsInfoMutation = useMutation({
    mutationFn: async (payload: { name: string; colorCode: string }) => {
      const response = await apiRequest("POST", "/api/treatments-info", payload);
      
      // Check response status first
      if (!response.ok) {
        let errorMessage = "Failed to create treatment entry";
        try {
          const errorText = await response.text();
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch {
            // If not JSON, check if it's HTML
            if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
              if (response.status === 404) {
                errorMessage = "API endpoint not found. Please check if the server endpoint exists.";
              } else if (response.status === 500) {
                errorMessage = "Server error occurred. Please check the server logs.";
              } else {
                errorMessage = `Server returned an error (Status: ${response.status}). Please check the server logs.`;
              }
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          errorMessage = `Failed to create treatment entry (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      // Response is OK, try to parse as JSON
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          // If content type suggests it's not JSON, read as text and try to parse
          const text = await response.text();
          if (text.trim() === "") {
            return {};
          }
          // Try to parse as JSON
          try {
            return JSON.parse(text);
          } catch {
            // If parsing fails, return empty object for successful responses
            return {};
          }
        }
      } catch (error: any) {
        // If JSON parsing fails but response was OK, return empty object
        console.warn("Failed to parse response as JSON, but response was OK:", error);
        return {};
      }
    },
    onMutate: () => {
      setIsSavingTreatmentInfo(true);
    },
    onSettled: () => {
      setIsSavingTreatmentInfo(false);
    },
    onSuccess: () => {
      toast({
        title: "Treatment created",
        description: "New treatment metadata has been saved."
      });
      closeTreatmentsInfoModal();
      invalidateTreatmentsInfoCache();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create treatment",
        description: error.message || "Unable to save the treatment metadata",
        variant: "destructive"
      });
    }
  });

  const updateTreatmentsInfoMutation = useMutation({
    mutationFn: async (payload: { id: number; name: string; colorCode: string }) => {
      const response = await apiRequest("PATCH", `/api/treatments-info/${payload.id}`, payload);
      
      // Check response status first
      if (!response.ok) {
        let errorMessage = "Failed to update treatment entry";
        try {
          const errorText = await response.text();
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch {
            // If not JSON, check if it's HTML
            if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
              if (response.status === 404) {
                errorMessage = "API endpoint not found. Please check if the server endpoint exists.";
              } else if (response.status === 500) {
                errorMessage = "Server error occurred. Please check the server logs.";
              } else {
                errorMessage = `Server returned an error (Status: ${response.status}). Please check the server logs.`;
              }
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          errorMessage = `Failed to update treatment entry (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      // Response is OK, try to parse as JSON
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          // If content type suggests it's not JSON, read as text and try to parse
          const text = await response.text();
          if (text.trim() === "") {
            return {};
          }
          // Try to parse as JSON
          try {
            return JSON.parse(text);
          } catch {
            // If parsing fails, return empty object for successful responses
            return {};
          }
        }
      } catch (error: any) {
        // If JSON parsing fails but response was OK, return empty object
        console.warn("Failed to parse response as JSON, but response was OK:", error);
        return {};
      }
    },
    onMutate: () => {
      setIsSavingTreatmentInfo(true);
    },
    onSettled: () => {
      setIsSavingTreatmentInfo(false);
    },
    onSuccess: () => {
      toast({
        title: "Treatment updated",
        description: "Treatment metadata has been updated."
      });
      closeTreatmentsInfoModal();
      invalidateTreatmentsInfoCache();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update treatment",
        description: error.message || "Unable to update the treatment metadata",
        variant: "destructive"
      });
    }
  });

  const deleteTreatmentsInfoMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/treatments-info/${id}`, {});
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete treatment metadata");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Treatment removed",
        description: "Treatment metadata has been deleted."
      });
      invalidateTreatmentsInfoCache();
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete treatment metadata",
        variant: "destructive"
      });
    }
  });

  const handleSaveTreatmentsInfo = async () => {
    if (!newTreatmentInfo.name.trim()) {
      toast({
        title: "Missing name",
        description: "Please provide a treatment name before saving.",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      name: newTreatmentInfo.name.trim(),
      colorCode: newTreatmentInfo.colorCode
    };

    if (editingTreatmentInfo && editingTreatmentInfo.id) {
      await updateTreatmentsInfoMutation.mutateAsync({
        id: editingTreatmentInfo.id,
        ...payload
      });
    } else {
      await createTreatmentsInfoMutation.mutateAsync(payload);
    }
  };

  const handleDeleteTreatmentsInfo = async (info: any) => {
    if (!info?.id) return;
    const confirmed = window.confirm(
      `Delete "${info.name}" from Treatments metadata? This cannot be undone.`
    );
    if (!confirmed) return;
    await deleteTreatmentsInfoMutation.mutateAsync(info.id);
  };

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    select: (data: any) => data || []
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
    select: (data: any) => data || []
  });

  const filteredUsers = users.filter((user: any) => {
    if (!formData.doctorRole) return true;
    return user.role === formData.doctorRole;
  });


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#serviceName') && !target.closest('.service-suggestions')) {
        setShowServiceSuggestions(false);
      }
      if (!target.closest('#doctorRole') && !target.closest('.role-suggestions')) {
        setShowRoleSuggestions(false);
      }
      if (!target.closest('#doctorName') && !target.closest('.doctor-suggestions')) {
        setShowDoctorSuggestions(false);
      }
      if (!target.closest('#testName') && !target.closest('.lab-test-suggestions')) {
        setShowLabTestSuggestions(false);
      }
      if (!target.closest('#labDoctorRole') && !target.closest('.lab-role-suggestions')) {
        setShowLabRoleSuggestions(false);
      }
      if (!target.closest('#labDoctorName') && !target.closest('.lab-doctor-suggestions')) {
        setShowLabDoctorSuggestions(false);
      }
      if (!target.closest('#imagingType') && !target.closest('.imaging-type-suggestions')) {
        setShowImagingTypeSuggestions(false);
      }
      if (!target.closest('#treatmentRole') && !target.closest('.treatment-role-suggestions')) {
        setShowTreatmentRoleSuggestions(false);
      }
      if (!target.closest('#treatmentDoctorName') && !target.closest('.treatment-doctor-suggestions')) {
        setShowTreatmentDoctorSuggestions(false);
      }
    };
    
    if (showServiceSuggestions || showRoleSuggestions || showDoctorSuggestions || 
        showLabTestSuggestions || showLabRoleSuggestions || showLabDoctorSuggestions || 
        showImagingTypeSuggestions || showTreatmentRoleSuggestions || showTreatmentDoctorSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [
    showServiceSuggestions,
    showRoleSuggestions,
    showDoctorSuggestions,
    showLabTestSuggestions,
    showLabRoleSuggestions,
    showLabDoctorSuggestions,
    showImagingTypeSuggestions,
    showTreatmentRoleSuggestions,
    showTreatmentDoctorSuggestions,
  ]);

  const getApiPath = (tab: string) => {
    const pathMap: Record<string, string> = {
      "doctors": "doctors-fees",
      "lab-tests": "lab-tests",
      "imaging": "imaging",
      "treatments": "treatments"
    };
    return pathMap[tab] || tab;
  };

  const { data: doctorsFeesData = [], isLoading: loadingDoctors } = useQuery<any[], Error>({
    queryKey: ["/api/pricing/doctors-fees"],
    queryFn: () => fetchResource("/api/pricing/doctors-fees"),
    enabled: pricingTab === "doctors"
  });
  const doctorsFees: any[] = doctorsFeesData ?? [];

  const { data: labTestsData = [], isLoading: loadingLabs, refetch: refetchLabTests } = useQuery<any[], Error>({
    queryKey: ["/api/pricing/lab-tests"],
    queryFn: async () => {
      const data = await fetchResource("/api/pricing/lab-tests");
      console.log('[LAB TESTS] Fetched data:', data, 'Type:', typeof data, 'IsArray:', Array.isArray(data));
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        // Handle wrapped response { data: [...] }
        return data.data;
      } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
        // Handle wrapped response { items: [...] }
        return data.items;
      }
      // Return empty array if data is not in expected format
      console.warn('[LAB TESTS] Unexpected data format:', data);
      return [];
    },
    enabled: pricingTab === "lab-tests"
  });
  const labTests: any[] = Array.isArray(labTestsData) ? labTestsData : [];

  const { data: imagingData = [], isLoading: loadingImaging } = useQuery<any[], Error>({
    queryKey: ["/api/pricing/imaging"],
    queryFn: () => fetchResource("/api/pricing/imaging"),
    enabled: pricingTab === "imaging"
  });
  const imaging: any[] = imagingData ?? [];

  const { data: treatmentsData = [], isLoading: loadingTreatments } = useQuery<any[], Error>({
    queryKey: ["/api/pricing/treatments"],
    queryFn: () => fetchResource("/api/pricing/treatments"),
    enabled: pricingTab === "treatments"
  });
  const treatments: any[] = treatmentsData ?? [];
  const { data: treatmentsInfoList = [], isLoading: loadingTreatmentsInfo } = useQuery<any[], Error>({
    queryKey: ["/api/treatments-info"],
    queryFn: () => fetchResource("/api/treatments-info"),
    enabled: true
  });

  const generateImagingCode = (imagingType: string) => {
    const codeMap: Record<string, string> = {
      "X-ray (Radiography)": "XRAY",
      "CT (Computed Tomography)": "CT",
      "MRI (Magnetic Resonance Imaging)": "MRI",
      "Ultrasound (Sonography)": "US",
      "Mammography": "MAMMO",
      "Fluoroscopy": "FLUORO",
      "PET (Positron Emission Tomography)": "PET",
      "SPECT (Single Photon Emission CT)": "SPECT",
      "Nuclear Medicine Scans": "NM",
      "DEXA (Bone Densitometry)": "DEXA",
      "Angiography": "ANGIO",
      "Interventional Radiology (IR)": "IR"
    };
    
    const prefix = codeMap[imagingType] || "IMG";
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${timestamp}`;
  };

  const handleDelete = async (type: string, id: number) => {
    try {
      const apiPath = getApiPath(type);
      const response = await apiRequest('DELETE', `/api/pricing/${apiPath}/${id}`, {});
      
      // Check if the response is OK
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete pricing entry");
      }
      
      // Use exact query key format that matches the useQuery hooks
      const queryKey = [`/api/pricing/${apiPath}`];
      
      // Remove the deleted item from cache immediately for instant UI update
      queryClient.setQueryData(queryKey, (oldData: any[] = []) => {
        return oldData.filter((item: any) => item.id !== id);
      });
      
      // Invalidate and refetch to ensure data consistency
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.refetchQueries({ queryKey });
      
      toast({ title: "Success", description: "Pricing entry deleted successfully" });
    } catch (error: any) {
      let errorMessage = "Failed to delete pricing entry";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Pricing entry not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Pricing entry not found in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Delete Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  const handleDeleteAllImaging = () => {
    if (imaging.length === 0) {
      toast({
        title: "No items to delete",
        description: "There are no imaging items to delete.",
        variant: "destructive"
      });
      return;
    }
    setShowDeleteAllImagingDialog(true);
  };

  const confirmDeleteAllImaging = async () => {
    setShowDeleteAllImagingDialog(false);
    setIsDeletingAllImaging(true);
    setCurrentlyDeletingImaging("");
    setDeleteProgress({ current: 0, total: imaging.length });

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      const deletedIds = new Set<number>();

      // Delete all imaging items one by one with proper error handling
      for (let i = 0; i < imaging.length; i++) {
        const img = imaging[i];
        try {
          setCurrentlyDeletingImaging(img.imagingType);
          setDeleteProgress({ current: i + 1, total: imaging.length });
          const response = await apiRequest('DELETE', `/api/pricing/imaging/${img.id}`, {});
          
          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`${img.imagingType}: ${errorText}`);
            failCount++;
          } else {
            successCount++;
            deletedIds.add(img.id);
          }
        } catch (error: any) {
          errors.push(`${img.imagingType}: ${error.message || 'Failed to delete'}`);
          failCount++;
        }
      }

      // Update cache immediately - remove all successfully deleted items
      // Use exact query key format that matches the useQuery hook
      const queryKey = ["/api/pricing/imaging"];
      
      // Store the snapshot of current data before deletion
      const currentData = queryClient.getQueryData<any[]>(queryKey) || [];
      
      // Remove the deleted items from cache immediately for instant UI update
      // This prevents items from reappearing after deletion
      const updatedData = currentData.filter((item: any) => !deletedIds.has(item.id));
      
      // Update cache with filtered data - this is the source of truth
      queryClient.setQueryData(queryKey, updatedData);
      
      // Mark queries as stale but don't immediately refetch
      // This ensures deleted items don't reappear from a server refetch
      queryClient.invalidateQueries({ queryKey });
      
      // Only refetch in background after successful deletion to sync with server
      // The cache update above ensures UI shows correct state even if refetch brings stale data
      if (successCount > 0) {
        // Use a longer delay to ensure server has processed all deletions
        setTimeout(async () => {
          try {
            const refetchedData = await queryClient.refetchQueries({ queryKey });
            // After refetch, ensure our cache update is still applied
            // This handles edge cases where server might return stale data
            const currentCache = queryClient.getQueryData<any[]>(queryKey) || [];
            const finalData = currentCache.filter((item: any) => !deletedIds.has(item.id));
            queryClient.setQueryData(queryKey, finalData);
          } catch (error) {
            // Silently handle refetch errors - cache update is already correct
          }
        }, 1000);
      }

      if (successCount > 0 && failCount === 0) {
        toast({ 
          title: "Success", 
          description: `All ${successCount} imaging pricing entries deleted successfully` 
        });
      } else if (successCount > 0 && failCount > 0) {
        toast({ 
          title: "Partial Success", 
          description: `Deleted ${successCount} entries, but ${failCount} failed. Check console for details.`,
          variant: "destructive"
        });
        console.error("Delete errors:", errors);
      } else {
        toast({ 
          title: "Delete Failed", 
          description: `Failed to delete all entries. Check console for details.`,
          variant: "destructive"
        });
        console.error("Delete errors:", errors);
      }
    } catch (error: any) {
      let errorMessage = "Failed to delete all imaging entries";
      
      if (error.message && typeof error.message === 'string') {
        if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Delete Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
      console.error("Delete all error:", error);
    } finally {
      setIsDeletingAllImaging(false);
      setCurrentlyDeletingImaging("");
      setDeleteProgress({ current: 0, total: 0 });
    }
  };

  const openAddTreatmentDialog = () => {
    setTreatmentForm({
      name: "",
      basePrice: "",
      colorCode: "#000000",
      doctorRole: "",
      doctorName: "",
      doctorId: null,
      treatmentInfoId: ""
    });
    setTreatmentError("");
    setEditingTreatment(null);
    setShowAddTreatmentDialog(true);
  };

  const openEditTreatmentDialog = (treatment: any) => {
    setTreatmentForm({
      name: treatment.name || "",
      basePrice: treatment.basePrice?.toString?.() ?? "",
      colorCode: treatment.colorCode || "#000000",
      doctorRole: treatment.doctorRole || "",
      doctorName: treatment.doctorName || "",
      doctorId: treatment.doctorId || null,
      treatmentInfoId: ""
    });
    setTreatmentError("");
    setEditingTreatment(treatment);
    setShowAddTreatmentDialog(true);
  };

  const handleTreatmentSave = async () => {
    if (!treatmentForm.name.trim()) {
      setTreatmentError("Treatment name is required");
      return;
    }
    if (!treatmentForm.basePrice) {
      setTreatmentError("Price is required");
      return;
    }

    const parsedPrice = parseFloat(treatmentForm.basePrice);
    if (Number.isNaN(parsedPrice)) {
      setTreatmentError("Price must be a number");
      return;
    }

    setIsSavingTreatment(true);
    try {
      // Use the string value for basePrice to satisfy Zod decimal schema if needed
      // and ensure doctorId is only sent if it has a value
      const payload: any = {
        name: treatmentForm.name.trim(),
        basePrice: treatmentForm.basePrice, // Sending as string
        colorCode: treatmentForm.colorCode,
        doctorRole: treatmentForm.doctorRole || null,
        doctorName: treatmentForm.doctorName || null,
        currency: "GBP",
      };

      if (treatmentForm.doctorId) {
        payload.doctorId = treatmentForm.doctorId;
      }

      if (editingTreatment) {
        await apiRequest("PATCH", `/api/pricing/treatments/${editingTreatment.id}`, payload);
        toast({ title: "Success", description: "Treatment updated" });
      } else {
        const response = await apiRequest("POST", "/api/pricing/treatments", payload);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to create treatment");
        }
        toast({ title: "Success", description: "Treatment added" });
      }

      // Invalidate and refetch to update the table
      await queryClient.invalidateQueries({ queryKey: ["/api/pricing/treatments"] });
      await queryClient.refetchQueries({ queryKey: ["/api/pricing/treatments"] });
      setShowAddTreatmentDialog(false);
      setEditingTreatment(null);
      setTreatmentForm({
        name: "",
        basePrice: "",
        colorCode: "#000000",
        doctorRole: "",
        doctorName: "",
        doctorId: null,
        treatmentInfoId: ""
      });
    } catch (error: any) {
      console.error("Save treatment error:", error);
      let msg = "Failed to save treatment";
      if (error.details) {
        // Zod error details format
        const details = typeof error.details === 'object' ? JSON.stringify(error.details) : error.details;
        msg = `Validation Error: ${details}`;
      } else if (error.message) {
        msg = error.message;
      }
      setTreatmentError(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSavingTreatment(false);
    }
  };

  const [treatmentToDelete, setTreatmentToDelete] = useState<{ id: number; name?: string } | null>(null);
  const [showDeleteTreatmentDialog, setShowDeleteTreatmentDialog] = useState(false);

  const handleDeleteTreatment = (treatment: any) => {
    if (!treatment?.id) {
      toast({
        title: "Delete Failed",
        description: "Treatment ID is missing. Unable to delete.",
        variant: "destructive",
      });
      return;
    }
    setTreatmentToDelete({ id: treatment.id, name: treatment.name });
    setShowDeleteTreatmentDialog(true);
  };

  const confirmDeleteTreatment = async () => {
    if (!treatmentToDelete) {
      setShowDeleteTreatmentDialog(false);
      toast({
        title: "Delete Failed",
        description: "Treatment ID is missing, please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("DELETE", `/api/pricing/treatments/${treatmentToDelete.id}`, {});
      toast({ title: "Success", description: "Treatment deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/treatments"] });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete treatment",
        variant: "destructive",
      });
    } finally {
      setShowDeleteTreatmentDialog(false);
      setTreatmentToDelete(null);
    }
  };

  const addDefaultLabTests = async () => {
    setIsAddingDefaultTests(true);
    try {
      const defaultTests = [
        { testName: "Complete Blood Count (CBC)", code: "CBC001", category: "Hematology", basePrice: 55.00 },
        { testName: "Basic Metabolic Panel (BMP) / Chem-7", code: "BMP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Comprehensive Metabolic Panel (CMP)", code: "CMP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Lipid Profile (Cholesterol, LDL, HDL, Triglycerides)", code: "LP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Thyroid Function Tests (TSH, Free T4, Free T3)", code: "TFT001", category: "Endocrinology", basePrice: 5.00 },
        { testName: "Liver Function Tests (AST, ALT, ALP, Bilirubin)", code: "LFT001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Kidney Function Tests (Creatinine, BUN, eGFR)", code: "KFT001", category: "Chemistry", basePrice: 342.00 },
        { testName: "Electrolytes (Sodium, Potassium, Chloride, Bicarbonate)", code: "E001", category: "Chemistry", basePrice: 223.00 },
        { testName: "Blood Glucose (Fasting / Random / Postprandial)", code: "BG001", category: "Chemistry", basePrice: 23234.00 },
        { testName: "Hemoglobin A1C (HbA1c)", code: "HA001", category: "Chemistry", basePrice: 44223.00 },
        { testName: "C-Reactive Protein (CRP)", code: "CRP001", category: "Immunology", basePrice: 4234.00 },
        { testName: "Erythrocyte Sedimentation Rate (ESR)", code: "ESR001", category: "Hematology", basePrice: 234.00 },
        { testName: "Coagulation Tests (PT, PTT, INR)", code: "CT001", category: "Hematology", basePrice: 44.00 },
        { testName: "Urinalysis (UA)", code: "UA001", category: "Urinalysis", basePrice: 3.00 },
        { testName: "Albumin / Total Protein", code: "ATP001", category: "Chemistry", basePrice: 4.00 },
        { testName: "Iron Studies (Serum Iron, TIBC, Ferritin)", code: "IS001", category: "Hematology", basePrice: 32.03 },
        { testName: "Vitamin D", code: "VD001", category: "Chemistry", basePrice: 3.00 },
        { testName: "Vitamin B12 / Folate", code: "VBF001", category: "Chemistry", basePrice: 3.00 },
        { testName: "Hormone Panels (e.g., LH, FSH, Testosterone, Estrogen)", code: "HP001", category: "Endocrinology", basePrice: 4.00 },
        { testName: "Prostate-Specific Antigen (PSA)", code: "PSA001", category: "Oncology", basePrice: 4.00 },
        { testName: "Thyroid Antibodies (e.g. Anti-TPO, Anti-TG)", code: "TA001", category: "Immunology", basePrice: 55.00 },
        { testName: "Creatine Kinase (CK)", code: "CK001", category: "Chemistry", basePrice: 155.00 },
        { testName: "Cardiac Biomarkers (Troponin, CK-MB, BNP)", code: "CB001", category: "Cardiology", basePrice: 1.00 },
        { testName: "Electrolyte Panel", code: "EP001", category: "Chemistry", basePrice: 55.00 },
        { testName: "Uric Acid", code: "UA002", category: "Chemistry", basePrice: 55.00 },
        { testName: "Lipase / Amylase (Pancreatic enzymes)", code: "LA001", category: "Chemistry", basePrice: 66.00 },
        { testName: "Hepatitis B / C Serologies", code: "HBC001", category: "Serology", basePrice: 77.00 },
        { testName: "HIV Antibody / Viral Load", code: "HIV001", category: "Serology", basePrice: 88.00 },
        { testName: "HCG (Pregnancy / Quantitative)", code: "HCG001", category: "Endocrinology", basePrice: 99.00 },
        { testName: "Autoimmune Panels (ANA, ENA, Rheumatoid Factor)", code: "AP001", category: "Immunology", basePrice: 54.50 },
        { testName: "Tumor Markers (e.g. CA-125, CEA, AFP)", code: "TM001", category: "Oncology", basePrice: 24.95 },
        { testName: "Blood Culture & Sensitivity", code: "BCS001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Stool Culture / Ova & Parasites", code: "SCOP001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Sputum Culture", code: "SC001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Viral Panels / PCR Tests (e.g. COVID-19, Influenza)", code: "VP001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Hormonal tests (Cortisol, ACTH)", code: "HT001", category: "Endocrinology", basePrice: 20.00 }
      ];

      // Fetch existing lab tests to check for duplicates
      const response = await fetch('/api/pricing/lab-tests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo'
        }
      });
      const existingTests = await response.json();

      let successCount = 0;
      let alreadyExistsCount = 0;

      for (const test of defaultTests) {
        // Check if test with same code already exists
        const exists = existingTests.some((existing: any) => existing.testCode === test.code);
        
        if (exists) {
          alreadyExistsCount++;
          continue;
        }

        try {
          await apiRequest('POST', '/api/pricing/lab-tests', {
            testName: test.testName,
            testCode: test.code,
            category: test.category,
            basePrice: test.basePrice,
            isActive: true,
            version: 1
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to add test ${test.testName}:`, error);
        }
      }

      // Invalidate and refetch the lab tests query
      // Add a small delay to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('[LAB TESTS] Invalidating and refetching lab tests query, pricingTab:', pricingTab);
      
      // Invalidate the query cache
      queryClient.invalidateQueries({ 
        queryKey: ['/api/pricing/lab-tests'],
        exact: false 
      });
      
      // Explicitly refetch if we're on the lab-tests tab
      if (pricingTab === "lab-tests") {
        // Use the refetch function directly from the useQuery hook
        try {
          await refetchLabTests();
          console.log('[LAB TESTS] Direct refetch completed');
        } catch (refetchError) {
          console.error('[LAB TESTS] Error during direct refetch:', refetchError);
        }
        
        // Also try refetching via queryClient as a fallback
        try {
          const result = await queryClient.refetchQueries({ 
            queryKey: ['/api/pricing/lab-tests'],
            exact: false
          });
          console.log('[LAB TESTS] QueryClient refetch result:', result);
        } catch (refetchError) {
          console.error('[LAB TESTS] Error during queryClient refetch:', refetchError);
        }
        
        // Also manually trigger a refetch after a short delay to ensure data is loaded
        setTimeout(async () => {
          try {
            queryClient.invalidateQueries({ 
              queryKey: ['/api/pricing/lab-tests'],
              exact: false 
            });
            await refetchLabTests();
            console.log('[LAB TESTS] Delayed refetch completed');
          } catch (error) {
            console.error('[LAB TESTS] Error during delayed refetch:', error);
          }
        }, 500);
      } else {
        console.log('[LAB TESTS] Not on lab-tests tab, skipping refetch');
      }

      if (alreadyExistsCount > 0 && successCount === 0) {
        setShowTestsExistsModal(true);
      } else if (successCount > 0) {
        toast({ 
          title: "Success", 
          description: `Added ${successCount} default lab tests${alreadyExistsCount > 0 ? ` (${alreadyExistsCount} already existed)` : ''}` 
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to add default tests";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Lab tests pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "Some tests already exist in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Add Tests", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsAddingDefaultTests(false);
    }
  };

  const addDefaultImaging = async () => {
    setIsAddingDefaultImaging(true);
    try {
      const defaultImaging = [
        { imagingType: "X-ray (Radiography)", code: "XRAY7672", basePrice: 50.00 },
        { imagingType: "CT (Computed Tomography)", code: "CT7672", basePrice: 54.00 },
        { imagingType: "MRI (Magnetic Resonance Imaging)", code: "MRI7672", basePrice: 43.00 },
        { imagingType: "Ultrasound (Sonography)", code: "US7672", basePrice: 39.00 },
        { imagingType: "Mammography", code: "MAMMO7672", basePrice: 34.00 },
        { imagingType: "Fluoroscopy", code: "FLUORO7672", basePrice: 23.00 },
        { imagingType: "PET (Positron Emission Tomography)", code: "PET0792", basePrice: 1.00 },
        { imagingType: "SPECT (Single Photon Emission CT)", code: "SPECT0792", basePrice: 1.00 },
        { imagingType: "Nuclear Medicine Scans", code: "NM0792", basePrice: 1.00 },
        { imagingType: "DEXA (Bone Densitometry)", code: "DEXA0792", basePrice: 11.00 },
        { imagingType: "Angiography", code: "ANGIO0792", basePrice: 1.00 },
        { imagingType: "Interventional Radiology (IR)", code: "IR0792", basePrice: 1.00 }
      ];

      // Fetch existing imaging to check for duplicates
      const response = await apiRequest('GET', '/api/pricing/imaging');
      if (!response.ok) {
        throw new Error('Failed to fetch existing imaging data');
      }
      const existingImaging = await response.json();

      let successCount = 0;
      let alreadyExistsCount = 0;

      for (const img of defaultImaging) {
        // Check if imaging with same code already exists
        const exists = existingImaging.some((existing: any) => existing.imagingCode === img.code);
        
        if (exists) {
          alreadyExistsCount++;
          continue;
        }

        try {
          const response = await apiRequest('POST', '/api/pricing/imaging', {
            imagingType: img.imagingType,
            imagingCode: img.code,
            modality: '',
            bodyPart: '',
            basePrice: img.basePrice.toString(), // Convert number to string for decimal type
            currency: 'GBP',
            isActive: true,
            version: 1
          });
          
          // Check if the response is OK
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to add imaging ${img.imagingType}:`, errorText);
            throw new Error(errorText || `Failed to add ${img.imagingType}`);
          }
          
          successCount++;
        } catch (error: any) {
          console.error(`Failed to add imaging ${img.imagingType}:`, error);
          // Continue with next item instead of stopping
        }
      }

      // Invalidate and refetch queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ['/api/pricing/imaging'] });
      await queryClient.refetchQueries({ queryKey: ['/api/pricing/imaging'] });

      if (alreadyExistsCount > 0 && successCount === 0) {
        setShowImagingExistsModal(true);
      } else if (successCount > 0) {
        toast({ 
          title: "Success", 
          description: `Added ${successCount} default imaging services${alreadyExistsCount > 0 ? ` (${alreadyExistsCount} already existed)` : ''}` 
        });
      } else if (successCount === 0 && alreadyExistsCount === 0) {
        toast({
          title: "No items added",
          description: "Failed to add any imaging services. Please check the console for errors.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to add default imaging services";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Imaging pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the imaging pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "Some imaging services already exist in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Add Imaging", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsAddingDefaultImaging(false);
    }
  };

  const handleSkipAndAddOthers = async () => {
    setIsSaving(true);
    try {
      const apiPath = getApiPath(pricingTab);
      const validServices = multipleServices.filter(
        service => service.serviceName && service.basePrice
      );
      
      // Filter out duplicate service names
      const newServices = validServices.filter(service => 
        !duplicateServiceNames.some(dup => dup.toLowerCase() === service.serviceName.toLowerCase())
      );
      
      if (newServices.length === 0) {
        toast({
          title: "No New Services",
          description: "All service names already exist in the database.",
          variant: "destructive"
        });
        setIsSaving(false);
        setShowDuplicateDialog(false);
        return;
      }
      
      // Create only new services
      for (const service of newServices) {
        const payload = {
          serviceName: service.serviceName,
          serviceCode: service.serviceCode,
          category: service.category,
          doctorId: formData.doctorId,
          doctorName: formData.doctorName,
          doctorRole: formData.doctorRole,
          basePrice: parseFloat(service.basePrice) || 0,
          isActive: true,
          currency: "GBP",
          version: 1
        };
        
        await apiRequest('POST', `/api/pricing/${apiPath}`, payload);
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
      toast({
        title: "Doctor Fees Added",
        description: `${newServices.length} new service(s) created successfully. ${duplicateServiceNames.length} duplicate(s) skipped.`
      });
      setShowAddDialog(false);
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
      setFormData({});
      setDuplicateServiceNames([]);
      setShowDuplicateDialog(false);
    } catch (error: any) {
      console.error("Error creating doctor fees:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create doctor fees",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDefaultDoctorFees = async () => {
    if (!formData.doctorRole) {
      setDoctorRoleError("Please select a role");
      return;
    }
    
    if (!formData.doctorName) {
      setDoctorNameError("Please select a name");
      return;
    }

    setIsAddingDefaultFees(true);
    try {
      const apiPath = getApiPath(pricingTab);
      
      // Check for existing fees for this specific doctor/role combination
      const existingFeesForDoctor = doctorsFees.filter((fee: any) => 
        fee.doctorName?.toLowerCase() === formData.doctorName.toLowerCase() &&
        fee.doctorRole?.toLowerCase() === formData.doctorRole.toLowerCase()
      );
      
      // Get service names that already exist for this doctor/role
      const existingServiceNames = existingFeesForDoctor.map((fee: any) => fee.serviceName.toLowerCase());
      
      // Filter out services that already exist for this doctor/role
      const newFees = DEFAULT_DOCTOR_FEES.filter(fee => 
        !existingServiceNames.includes(fee.serviceName.toLowerCase())
      );
      
      if (newFees.length === 0) {
        setDefaultFeesSuccessMessage({
          title: "All Default Fees Already Exist",
          description: `All default doctor fees already exist for ${formData.doctorName} (${formData.doctorRole}).`
        });
        setShowDefaultFeesSuccessModal(true);
        setIsAddingDefaultFees(false);
        return;
      }
      
      // Add only new fees for this doctor/role
      let addedCount = 0;
      let skippedCount = 0;
      
      for (const fee of DEFAULT_DOCTOR_FEES) {
        const exists = existingServiceNames.includes(fee.serviceName.toLowerCase());
        
        if (!exists) {
          const payload = {
            serviceName: fee.serviceName,
            serviceCode: fee.serviceCode,
            category: fee.category,
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            doctorRole: formData.doctorRole,
            basePrice: parseFloat(fee.basePrice) || 0,
            isActive: true,
            currency: "GBP",
            version: 1
          };
          
          await apiRequest('POST', `/api/pricing/${apiPath}`, payload);
          addedCount++;
        } else {
          skippedCount++;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
      setDefaultFeesSuccessMessage({
        title: "Default Doctor Fees Added",
        description: `${addedCount} default fee(s) added successfully for ${formData.doctorName} (${formData.doctorRole}). ${skippedCount > 0 ? `${skippedCount} fee(s) already existed and were skipped.` : ''}`
      });
      setShowDefaultFeesSuccessModal(true);
      setIsAddingDefaultFees(false);
    } catch (error: any) {
      console.error("Error adding default doctor fees:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add default doctor fees",
        variant: "destructive"
      });
      setIsAddingDefaultFees(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const apiPath = getApiPath(pricingTab);
      
      // Handle multiple services for doctors fees, lab tests, and imaging when not editing
      if ((pricingTab === "doctors" || pricingTab === "lab-tests" || pricingTab === "imaging") && !editingItem) {
        // Validation for doctors fees
        if (pricingTab === "doctors") {
          // Reset errors first
          setDoctorRoleError("");
          setDoctorNameError("");
          
          let hasError = false;
          
          if (!formData.doctorRole) {
            setDoctorRoleError("Please select a role");
            hasError = true;
          }
          
          if (!formData.doctorName) {
            setDoctorNameError("Please select a name");
            hasError = true;
          }
          
          if (hasError) {
            setIsSaving(false);
            return;
          }
        }
        
        // Only process custom services from multipleServices (not existing/default ones)
        // For imaging: only process entries from "Add Custom Imaging" section, skip "Existing Imaging in Database"
        let validServices = multipleServices.filter(
          service => service.serviceName && service.basePrice
        );
        
        if (validServices.length === 0) {
          if (pricingTab === "lab-tests") {
            setLabTestError("Please add at least one test with name and price");
          } else if (pricingTab === "imaging") {
            setImagingError("Please add at least one imaging service with name and price");
          } else if (pricingTab === "doctors") {
            // For doctors, still use toast as it doesn't have dedicated error state
            toast({
              title: "Error",
              description: "Please add at least one service with name and price",
              variant: "destructive"
            });
          }
          setIsSaving(false);
          return;
        }
        
        // Clear validation errors if validation passes
        if (pricingTab === "lab-tests") {
          setLabTestError("");
        } else if (pricingTab === "imaging") {
          setImagingError("");
        }
        
        // Check for duplicate service names (doctors fees and imaging)
        if (pricingTab === "doctors") {
          try {
            const serviceNames = validServices.map(s => s.serviceName);
            const checkResponse = await apiRequest('POST', '/api/pricing/doctors-fees/check-duplicates', { serviceNames });
            const checkData = await checkResponse.json();
            
            if (checkData.duplicates && checkData.duplicates.length > 0) {
              setDuplicateServiceNames(checkData.duplicates);
              setShowDuplicateDialog(true);
              setIsSaving(false);
              return;
            }
          } catch (error: any) {
            console.error("Error checking for duplicates:", error);
            // Continue with creation if check fails
          }
        } else if (pricingTab === "imaging") {
          // Check for duplicate imaging types
          try {
            const imagingTypes = validServices.map(s => s.serviceName.trim()).filter(Boolean);
            if (imagingTypes.length > 0) {
              const checkResponse = await apiRequest('POST', '/api/pricing/imaging/check-duplicates', { imagingTypes });
              const checkData = await checkResponse.json();
              
              if (checkData.duplicates && checkData.duplicates.length > 0) {
                // Filter out duplicates and only add new ones
                const newServices = validServices.filter(service => {
                  const serviceName = service.serviceName.trim();
                  return serviceName && !checkData.duplicates.some((dup: string) => 
                    dup.toLowerCase() === serviceName.toLowerCase()
                  );
                });
                
                if (newServices.length === 0) {
                  toast({
                    title: "All Imaging Services Already Exist",
                    description: "All imaging services already exist in the database.",
                    variant: "default"
                  });
                  setIsSaving(false);
                  return;
                }
                
                // Replace validServices with only new ones (skip duplicates)
                validServices = newServices;
                
                toast({
                  title: "Skipping Duplicates",
                  description: `${checkData.duplicates.length} imaging service(s) already exist and will be skipped. ${newServices.length} new service(s) will be added.`,
                  variant: "default"
                });
              }
            }
          } catch (error: any) {
            console.error("Error checking for duplicate imaging:", error);
            // Continue with creation if check fails
          }
        }
        
        // Create only custom services/tests/imaging from the "Add Custom" section
        // Note: This only processes entries from multipleServices, not existing/default entries
        // For imaging: validServices contains ONLY entries from "Add Custom Imaging" table, NOT from "Existing Imaging in Database"
        // Duplicates have already been filtered out for imaging
        for (const service of validServices) {
          // Additional validation: Ensure we're only processing custom entries with valid data
          if (!service.serviceName || !service.serviceName.trim()) {
            continue; // Skip empty entries
          }
          
          let payload: any = {};
          
          if (pricingTab === "doctors") {
            payload = {
              serviceName: service.serviceName.trim(),
              serviceCode: service.serviceCode?.trim() || "",
              category: service.category?.trim() || "",
              doctorId: formData.doctorId,
              doctorName: formData.doctorName,
              doctorRole: formData.doctorRole,
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: true,
              currency: "GBP",
              version: 1
            };
          } else if (pricingTab === "lab-tests") {
            payload = {
              testName: service.serviceName.trim(),
              testCode: service.serviceCode?.trim() || "",
              category: service.category?.trim() || "",
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: true,
              currency: "GBP",
              version: 1
            };
          } else if (pricingTab === "imaging") {
            // Only create imaging services from "Add Custom Imaging" section
            // This explicitly excludes any default/existing imaging from "Existing Imaging in Database"
            // Duplicates have already been filtered out above
            payload = {
              imagingType: service.serviceName.trim(),
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: formData.isActive !== undefined ? formData.isActive : true,
              currency: "GBP",
              version: 1
            };
            
            // Add optional fields only if they have values
            if (service.serviceCode?.trim()) {
              payload.imagingCode = service.serviceCode.trim();
            }
            if (service.category?.trim()) {
              payload.modality = service.category.trim();
            }
          }
          
          await apiRequest('POST', `/api/pricing/${apiPath}`, payload);
        }
        
        queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
        toast({
          title: pricingTab === "doctors" 
            ? "Doctor Fee Added"
            : pricingTab === "lab-tests"
            ? "Lab Test Added"
            : "Imaging Service Added",
          description: pricingTab === "doctors" 
            ? `${validServices.length} service(s) created successfully`
            : pricingTab === "lab-tests"
            ? `${validServices.length} test(s) created successfully`
            : `${validServices.length} imaging service(s) created successfully`
        });
        setShowAddDialog(false);
        setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
        setFormData({});
        setDuplicateServiceNames([]);
        setShowDuplicateDialog(false);
      } else {
        // Original single save logic for editing or other tabs
        const endpoint = editingItem 
          ? `/api/pricing/${apiPath}/${editingItem.id}`
          : `/api/pricing/${apiPath}`;
        const method = editingItem ? 'PATCH' : 'POST';
        
        // Build payload based on pricing tab
        let payload: any = {};
        
        if (pricingTab === "doctors") {
          payload = {
            serviceName: formData.serviceName,
            serviceCode: formData.serviceCode,
            category: formData.category,
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            doctorRole: formData.doctorRole,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "GBP",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else if (pricingTab === "lab-tests") {
          payload = {
            testName: formData.testName,
            testCode: formData.testCode,
            category: formData.category,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "USD",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else if (pricingTab === "imaging") {
          payload = {
            imagingType: formData.imagingType,
            imagingCode: formData.imagingCode,
            modality: formData.modality,
            bodyPart: formData.bodyPart,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "USD",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else {
          payload = {
            ...formData,
            basePrice: parseFloat(formData.basePrice) || 0
          };
        }
        
        await apiRequest(method, endpoint, payload);

        queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
        toast({ 
          title: "Success", 
          description: editingItem ? "Pricing updated successfully" : "Pricing created successfully" 
        });
        setShowAddDialog(false);
        setEditingItem(null);
        setFormData({});
      }
    } catch (error: any) {
      let errorMessage = "Failed to save pricing";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "This pricing entry already exists";
        } else if (error.message.includes("validation")) {
          errorMessage = "Please check your input and try again";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Save", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openAddDialog = () => {
    setFormData({
      isActive: true,
      currency: "GBP",
      version: 1
    });
    
    // Close all dropdowns
    setShowRoleSuggestions(false);
    setShowDoctorSuggestions(false);
    setShowServiceSuggestions(false);
    setShowLabTestSuggestions(false);
    setShowLabRoleSuggestions(false);
    setShowLabDoctorSuggestions(false);
    setShowImagingTypeSuggestions(false);
    
    // Reset validation errors
    setDoctorRoleError("");
    setDoctorNameError("");
    setLabTestError("");
    setImagingError("");
    
    // Start with one blank row for custom doctor fees (do not pre-populate with predefined services)
    if (pricingTab === "doctors") {
      // Start with one blank row for custom doctor fee
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    } else if (pricingTab === "imaging") {
      // Start with one blank row for custom imaging
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    } else if (pricingTab === "lab-tests") {
      // Start with one blank row for custom tests
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    } else {
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    }
    
    setEditingItem(null);
    setShowAddDialog(true);
    setSkipRoleSuggestionFocus(true);
    setDuplicateServiceNames([]);
    setShowDuplicateDialog(false);
    setTimeout(() => setSkipRoleSuggestionFocus(false), 0);
  };

  const openEditDialog = (item: any) => {
    setFormData(item);
    setEditingItem(item);
    setShowAddDialog(true);
  };

  return (
  <Tabs value={pricingTab} onValueChange={setPricingTab} className="w-full">
    <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="doctors" data-testid="tab-doctors-pricing">Doctors Fees</TabsTrigger>
        <TabsTrigger value="lab-tests" data-testid="tab-lab-tests-pricing">Lab Tests</TabsTrigger>
        <TabsTrigger value="imaging" data-testid="tab-imaging-pricing">Imaging</TabsTrigger>
        <TabsTrigger value="treatments" data-testid="tab-treatments-pricing">Treatments</TabsTrigger>
      <TabsTrigger value="all-treatments" data-testid="tab-all-treatments">Add Treatments</TabsTrigger>
      </TabsList>

      <TabsContent value="doctors" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Doctors Fee Pricing</h3>
          <Button size="sm" onClick={openAddDialog} data-testid="button-add-doctor-fee">
            <Plus className="h-4 w-4 mr-2" />
            Add Doctor Fee
          </Button>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor="filter-service-name">Filter by Service Name</Label>
            <Input
              id="filter-service-name"
              placeholder="Search service name..."
              value={doctorFeeServiceFilter}
              onChange={(e) => setDoctorFeeServiceFilter(e.target.value)}
              data-testid="input-filter-service-name"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="filter-fee-doctor-name">Filter by Doctor Name</Label>
            <Input
              id="filter-fee-doctor-name"
              placeholder="Search doctor name..."
              value={doctorFeeDoctorFilter}
              onChange={(e) => setDoctorFeeDoctorFilter(e.target.value)}
              data-testid="input-filter-fee-doctor-name"
            />
          </div>
          {(doctorFeeServiceFilter || doctorFeeDoctorFilter) && (
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDoctorFeeServiceFilter("");
                  setDoctorFeeDoctorFilter("");
                }}
                data-testid="button-clear-fee-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        
        {loadingDoctors ? (
          <div className="text-center py-8">Loading...</div>
        ) : doctorsFees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No doctor fees configured yet. Click "Add Doctor Fee" to get started.</p>
          </div>
        ) : (() => {
          const filteredFees = doctorsFees.filter((fee: any) => {
            const matchServiceName = !doctorFeeServiceFilter || 
              fee.serviceName?.toLowerCase().includes(doctorFeeServiceFilter.toLowerCase());
            const matchDoctorName = !doctorFeeDoctorFilter || 
              fee.doctorName?.toLowerCase().includes(doctorFeeDoctorFilter.toLowerCase());
            return matchServiceName && matchDoctorName;
          });

          return filteredFees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No doctor fees match your filters. Try adjusting your search criteria.</p>
            </div>
          ) : (() => {
            // Group fees by role, then by doctor/nurse name within each role
            const groupedByRoleAndName = filteredFees.reduce((acc: any, fee: any) => {
              const role = fee.doctorRole || 'Unknown';
              const doctorName = fee.doctorName || 'Unknown';
              
              if (!acc[role]) {
                acc[role] = {};
              }
              if (!acc[role][doctorName]) {
                acc[role][doctorName] = [];
              }
              acc[role][doctorName].push(fee);
              return acc;
            }, {});

            const roleGroups = Object.entries(groupedByRoleAndName).sort((a, b) => {
              // Sort roles alphabetically, but put 'Unknown' at the end
              if (a[0] === 'Unknown') return 1;
              if (b[0] === 'Unknown') return -1;
              return a[0].localeCompare(b[0]);
            });

            return (
              <div className="space-y-4">
                {roleGroups.map(([role, nameGroups]: [string, any]) => (
                  <div key={role} className="border rounded-md overflow-hidden bg-white dark:bg-gray-900">
                    {/* Role Header */}
                    <div className="bg-gray-200 dark:bg-gray-700 px-4 py-3 font-semibold text-base sticky top-0 z-10">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </div>
                    {/* Group by doctor/nurse name within this role */}
                    {Object.entries(nameGroups as Record<string, any[]>)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([doctorName, fees]: [string, any[]]) => (
                        <div key={`${role}-${doctorName}`} className="border-b last:border-b-0">
                          {/* Doctor/Nurse Name Header */}
                          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-medium text-sm">
                            {doctorName}
                          </div>
                          {/* Fees Table for this Doctor/Nurse */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                  <th className="text-left p-3">Service Name</th>
                                  <th className="text-left p-3">Doctor Name</th>
                                  <th className="text-left p-3">Code</th>
                                  <th className="text-left p-3">Category</th>
                                  <th className="text-left p-3">Price</th>
                                  <th className="text-left p-3">Status</th>
                                  <th className="text-left p-3">Version</th>
                                  <th className="text-left p-3">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fees.map((fee: any) => (
                                  <tr key={fee.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-doctor-fee-${fee.id}`}>
                                    <td className="p-3 font-medium">{fee.serviceName}</td>
                                    <td className="p-3">{fee.doctorName || '-'}</td>
                                    <td className="p-3">{fee.serviceCode || '-'}</td>
                                    <td className="p-3">{fee.category || '-'}</td>
                                    <td className="p-3 font-semibold">{fee.currency} {fee.basePrice}</td>
                                    <td className="p-3">
                                      <Badge variant={fee.isActive ? "default" : "secondary"}>
                                        {fee.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                    </td>
                                    <td className="p-3">v{fee.version}</td>
                                    <td className="p-3">
                                      <div className="flex gap-2">
                                        {canEdit('billing') && (
                                          <Button size="sm" variant="outline" onClick={() => openEditDialog(fee)} data-testid={`button-edit-${fee.id}`}>
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {canDelete('billing') && (
                                          <Button size="sm" variant="outline" onClick={() => handleDelete("doctors-fees", fee.id)} data-testid={`button-delete-${fee.id}`}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            );
          })();
        })()}
      </TabsContent>

      <TabsContent value="lab-tests" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Lab Test Pricing</h3>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={addDefaultLabTests} 
              disabled={defaultTestsAdded || isAddingDefaultTests}
              data-testid="button-default-tests"
            >
              {isAddingDefaultTests ? "Adding..." : "Default Tests"}
            </Button>
            {canCreate('billing') && (
              <Button size="sm" onClick={openAddDialog} data-testid="button-add-lab-test">
                <Plus className="h-4 w-4 mr-2" />
                Add Lab Test
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor="filter-test-name">Filter by Test Name</Label>
            <Input
              id="filter-test-name"
              placeholder="Search test name..."
              value={labTestFilter}
              onChange={(e) => setLabTestFilter(e.target.value)}
              data-testid="input-filter-test-name"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="filter-doctor-name">Filter by Doctor Name</Label>
            <Input
              id="filter-doctor-name"
              placeholder="Search doctor name..."
              value={labDoctorFilter}
              onChange={(e) => setLabDoctorFilter(e.target.value)}
              data-testid="input-filter-doctor-name"
            />
          </div>
          {(labTestFilter || labDoctorFilter) && (
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setLabTestFilter("");
                  setLabDoctorFilter("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        
        {loadingLabs ? (
          <div className="text-center py-8">Loading...</div>
        ) : labTests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No lab test pricing configured yet. Click "Add Lab Test" to get started.</p>
          </div>
        ) : (() => {
          const filteredTests = labTests.filter((test: any) => {
            const matchTestName = !labTestFilter || 
              test.testName?.toLowerCase().includes(labTestFilter.toLowerCase());
            const matchDoctorName = !labDoctorFilter || 
              test.doctorName?.toLowerCase().includes(labDoctorFilter.toLowerCase());
            return matchTestName && matchDoctorName;
          });

          return filteredTests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No lab tests match your filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800">
                    <th className="text-left p-3">Test Name</th>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Version</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.map((test: any) => (
                    <tr key={test.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-lab-test-${test.id}`}>
                      <td className="p-3 font-medium">{test.testName}</td>
                      <td className="p-3">{test.testCode || '-'}</td>
                      <td className="p-3">{test.category || '-'}</td>
                      <td className="p-3 font-semibold">{test.currency} {test.basePrice}</td>
                      <td className="p-3">
                        <Badge variant={test.isActive ? "default" : "secondary"}>
                          {test.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">v{test.version}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {canEdit('billing') && (
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(test)} data-testid={`button-edit-${test.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete('billing') && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete("lab-tests", test.id)} data-testid={`button-delete-${test.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </TabsContent>

      <TabsContent value="imaging" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Imaging Pricing</h3>
          <div className="flex gap-2">
            {canDelete('billing') && imaging.length > 0 && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={handleDeleteAllImaging} 
                data-testid="button-delete-all-imaging"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={addDefaultImaging} 
              disabled={isAddingDefaultImaging}
              data-testid="button-default-imaging"
            >
              {isAddingDefaultImaging ? "Adding..." : "Default Imaging"}
            </Button>
            {canCreate('billing') && (
              <Button size="sm" onClick={openAddDialog} data-testid="button-add-imaging">
                <Plus className="h-4 w-4 mr-2" />
                Add Imaging Service
              </Button>
            )}
          </div>
        </div>
        
        {loadingImaging ? (
          <div className="text-center py-8">Loading...</div>
        ) : imaging.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No imaging pricing configured yet. Click "Add Imaging Service" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-3">Imaging Type</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Modality</th>
                  <th className="text-left p-3">Body Part</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Version</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {imaging.map((img: any) => (
                  <tr key={img.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-imaging-${img.id}`}>
                    <td className="p-3 font-medium">{img.imagingType}</td>
                    <td className="p-3">{img.imagingCode || '-'}</td>
                    <td className="p-3">{img.modality || '-'}</td>
                    <td className="p-3">{img.bodyPart || '-'}</td>
                    <td className="p-3 font-semibold">{img.currency} {img.basePrice}</td>
                    <td className="p-3">
                      <Badge variant={img.isActive ? "default" : "secondary"}>
                        {img.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">v{img.version}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {canEdit('billing') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(img);
                            }} 
                            data-testid={`button-edit-${img.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('billing') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete("imaging", img.id);
                            }} 
                            data-testid={`button-delete-${img.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="treatments" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Treatments</h3>
          {canCreate('billing') && (
            <Button size="sm" onClick={openAddTreatmentDialog} data-testid="button-add-treatments">
              <Plus className="h-4 w-4 mr-2" />
              Add Treatment
            </Button>
          )}
        </div>

        {loadingTreatments ? (
          <div className="text-center py-8">Loading...</div>
        ) : treatments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No treatments configured yet. Click "Add Treatments" to get started.</p>
          </div>
        ) : (() => {
          // Group treatments by role, then by doctor/nurse name within each role
          const groupedByRoleAndName = treatments.reduce((acc: any, treatment: any) => {
            const role = treatment.doctorRole || 'Unknown';
            const doctorName = treatment.doctorName || 'Unknown';
            
            if (!acc[role]) {
              acc[role] = {};
            }
            if (!acc[role][doctorName]) {
              acc[role][doctorName] = [];
            }
            acc[role][doctorName].push(treatment);
            return acc;
          }, {});

          const roleGroups = Object.entries(groupedByRoleAndName).sort((a, b) => {
            // Sort roles alphabetically, but put 'Unknown' at the end
            if (a[0] === 'Unknown') return 1;
            if (b[0] === 'Unknown') return -1;
            return a[0].localeCompare(b[0]);
          });

          return (
            <div className="space-y-4">
              {roleGroups.map(([role, nameGroups]: [string, any]) => (
                <div key={role} className="border rounded-md overflow-hidden bg-white dark:bg-gray-900">
                  {/* Role Header */}
                  <div className="bg-gray-200 dark:bg-gray-700 px-4 py-3 font-semibold text-base sticky top-0 z-10">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </div>
                  {/* Group by doctor/nurse name within this role */}
                  {Object.entries(nameGroups as Record<string, any[]>)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([doctorName, treatmentsList]: [string, any[]]) => (
                      <div key={`${role}-${doctorName}`} className="border-b last:border-b-0">
                        {/* Doctor/Nurse Name Header */}
                        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 font-medium text-sm">
                          {doctorName}
                        </div>
                        {/* Treatments Table for this Doctor/Nurse */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                <th className="text-left p-3">Name</th>
                                <th className="text-left p-3">Role</th>
                                <th className="text-left p-3">Assigned To</th>
                                <th className="text-left p-3">Price</th>
                                <th className="text-left p-3">Color</th>
                                <th className="text-left p-3">Status</th>
                                <th className="text-left p-3">Version</th>
                                <th className="text-left p-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {treatmentsList.map((treatment: any) => (
                                <tr key={treatment.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <td className="p-3 font-medium">{treatment.name}</td>
                                  <td className="p-3 text-gray-600 dark:text-gray-400 capitalize">{treatment.doctorRole || "—"}</td>
                                  <td className="p-3 font-medium text-blue-600 dark:text-blue-400">{treatment.doctorName || "—"}</td>
                                  <td className="p-3 font-semibold">
                                    {(() => {
                                      const priceNumber = Number(treatment.basePrice);
                                      return Number.isNaN(priceNumber)
                                        ? `${treatment.currency || ""} ${treatment.basePrice ?? "—"}`.trim()
                                        : formatCurrency(priceNumber);
                                    })()}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <span 
                                        className="w-4 h-4 rounded-full border" 
                                        style={{ backgroundColor: treatment.colorCode || "#000" }}
                                        aria-hidden="true"
                                      />
                                      <span>{treatment.colorCode || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant={treatment.isActive ? "default" : "secondary"}>
                                      {treatment.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </td>
                                  <td className="p-3">v{treatment.version ?? 1}</td>
                                  <td className="p-3">
                                    <div className="flex gap-2">
                                      {canEdit('billing') && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openEditTreatmentDialog(treatment)}
                                          data-testid={`button-edit-treatment-${treatment.id}`}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {canDelete('billing') && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteTreatment(treatment)}
                                          data-testid={`button-delete-treatment-${treatment.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          );
        })()}
      </TabsContent>

      <TabsContent value="all-treatments" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-lg font-semibold">Add Treatments Metadata</h3>
            <span className="text-sm text-gray-500">
              {treatmentsInfoList.length} entries
            </span>
          </div>
          {canCreate('billing') && (
            <Button
              size="sm"
              variant="outline"
              onClick={openTreatmentsInfoModalForCreate}
              data-testid="button-create-treatments-info-alt"
              disabled={isSavingTreatmentInfo}
            >
              Create Treatments
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Color</th>
                <th className="text-left p-3">Created At</th>
              <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {treatmentsInfoList.map((info: any) => (
                <tr key={info.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="p-3">{info.id}</td>
                  <td className="p-3 font-medium">{info.name}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: info.colorCode || "#000" }}
                      />
                      <span>{info.colorCode?.toUpperCase() || "—"}</span>
                    </div>
                  </td>
                  <td className="p-3">{new Date(info.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTreatmentsInfoModalForEdit(info)}
                        data-testid={`button-edit-treatment-info-${info.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTreatmentsInfo(info)}
                        data-testid={`button-delete-treatment-info-${info.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabsContent>


      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {pricingTab === "doctors" ? "Doctor Fee" : pricingTab === "lab-tests" ? "Lab Test" : "Imaging Service"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {pricingTab === "doctors" && !editingItem && (
              <>
                {/* Existing Doctor Fees in Database (Read-only) - Grouped by Doctor */}
                {(() => {
                  // Group fees by doctor name and role
                  const groupedFees = doctorsFees.reduce((acc: any, fee: any) => {
                    const key = `${fee.doctorName || 'Unknown'}_${fee.doctorRole || 'Unknown'}`;
                    if (!acc[key]) {
                      acc[key] = {
                        doctorName: fee.doctorName || 'Unknown',
                        doctorRole: fee.doctorRole || 'Unknown',
                        fees: []
                      };
                    }
                    acc[key].fees.push(fee);
                    return acc;
                  }, {});

                  const groupedArray = Object.values(groupedFees);

                  return groupedArray.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Existing Doctor Fees in Database</Label>
                      <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                        {groupedArray.map((group: any, groupIndex: number) => (
                          <div key={groupIndex} className="border-b last:border-b-0">
                            <div className="bg-gray-200 dark:bg-gray-700 px-3 py-2 font-semibold text-sm sticky top-0">
                              {group.doctorName} ({group.doctorRole})
                            </div>
                            <table className="w-full">
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                  <th className="text-left p-2 text-sm font-medium">Service Name</th>
                                  <th className="text-left p-2 text-sm font-medium">Code</th>
                                  <th className="text-left p-2 text-sm font-medium">Category</th>
                                  <th className="text-left p-2 text-sm font-medium">Price (£)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.fees.map((fee: any) => (
                                  <tr key={fee.id} className="border-t">
                                    <td className="p-2 text-sm">{fee.serviceName}</td>
                                    <td className="p-2 text-sm">{fee.serviceCode || '-'}</td>
                                    <td className="p-2 text-sm">{fee.category || '-'}</td>
                                    <td className="p-2 text-sm">{fee.basePrice}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2 relative">
                    <Label htmlFor="bulkDoctorRole">Role <span className="text-red-500">*</span></Label>
                    <Input
                      id="bulkDoctorRole"
                      value={formData.doctorRole || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, doctorRole: e.target.value, doctorName: "", doctorId: null });
                        setShowRoleSuggestions(true);
                        setDoctorRoleError(""); // Clear error on change
                      }}
                      onFocus={() => {
                        if (skipRoleSuggestionFocus) {
                          setSkipRoleSuggestionFocus(false);
                          return;
                        }
                        setShowRoleSuggestions(true);
                      }}
                      onClick={() => setShowRoleSuggestions(true)}
                      placeholder="Select role"
                      autoComplete="off"
                      required
                      data-testid="input-bulk-role"
                    />
                    {showRoleSuggestions && (
                      <div className="role-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                        {roles
                          .filter((role: any) => 
                            role.name !== 'patient' && 
                            role.name !== 'admin' &&
                            (!formData.doctorRole || 
                            role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                            role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                          )
                          .map((role: any, index: number) => (
                            <div
                              key={index}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                setFormData({ ...formData, doctorRole: role.name, doctorName: "", doctorId: null });
                                setShowRoleSuggestions(false);
                              }}
                            >
                              <div className="font-medium text-sm">{role.displayName}</div>
                            </div>
                          ))}
                        {roles.filter((role: any) => 
                          role.name !== 'patient' && 
                          role.name !== 'admin' &&
                          (!formData.doctorRole || 
                          role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                          role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                        ).length === 0 && formData.doctorRole && (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No roles found. You can enter a custom role name.
                          </div>
                        )}
                      </div>
                    )}
                    {doctorRoleError && (
                      <p className="text-sm text-red-500 mt-1">{doctorRoleError}</p>
                    )}
                  </div>

                  <div className="grid gap-2 relative">
                    <Label htmlFor="bulkDoctorName">Select Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="bulkDoctorName"
                      value={formData.doctorName || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, doctorName: e.target.value });
                        setShowDoctorSuggestions(true);
                        setDoctorNameError(""); // Clear error on change
                      }}
                      onFocus={() => {
                        if (!formData.doctorRole) {
                          return;
                        }
                        setShowDoctorSuggestions(true);
                      }}
                      placeholder={formData.doctorRole ? "Select or enter name" : "Select role first"}
                      autoComplete="off"
                      required
                      disabled={!formData.doctorRole}
                      data-testid="input-bulk-name"
                    />
                    {showDoctorSuggestions && (
                      <div className="doctor-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                        {filteredUsers
                          .filter((user: any) => {
                            const fullName = `${user.firstName} ${user.lastName}`;
                            return !formData.doctorName || 
                              fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                          })
                          .map((user: any, index: number) => (
                            <div
                              key={index}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                const fullName = `${user.firstName} ${user.lastName}`;
                                setFormData({ 
                                  ...formData, 
                                  doctorName: fullName,
                                  doctorId: user.id,
                                  doctorRole: formData.doctorRole || user.role
                                });
                                setShowDoctorSuggestions(false);
                              }}
                            >
                              <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>
                            </div>
                          ))}
                        {filteredUsers.filter((user: any) => {
                          const fullName = `${user.firstName} ${user.lastName}`;
                          return !formData.doctorName || 
                            fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                        }).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No users found. {formData.doctorRole && `Try changing the role filter.`}
                          </div>
                        )}
                      </div>
                    )}
                    {doctorNameError && (
                      <p className="text-sm text-red-500 mt-1">{doctorNameError}</p>
                    )}
                  </div>
                </div>

                {/* Default Doctor Fee Button */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddDefaultDoctorFees}
                    disabled={isAddingDefaultFees}
                    className="w-full sm:w-auto"
                  >
                    {isAddingDefaultFees ? "Adding..." : "Default Doctor Fee"}
                  </Button>
                </div>

                {/* Add Custom Doctor Fees (Editable) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Add Custom Doctor Fee</Label>
                  <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Service Name *</th>
                          <th className="text-left p-2 text-sm font-medium">Service Code</th>
                          <th className="text-left p-2 text-sm font-medium">Category</th>
                          <th className="text-left p-2 text-sm font-medium">Base Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  // Auto-generate service code from service name
                                  const words = e.target.value.trim().split(/\s+/);
                                  const initials = words.map(word => word.charAt(0).toUpperCase()).join('');
                                  if (initials) {
                                    updated[index].serviceCode = `${initials}001`;
                                  }
                                  
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., General Consultation"
                                data-testid={`input-service-name-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., GC001"
                                data-testid={`input-service-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.category}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].category = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Diagnostic"
                                data-testid={`input-category-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="0.00"
                                data-testid={`input-base-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-service-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-service"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Service
                  </Button>
                </div>
              </>
            )}

            {pricingTab === "doctors" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={formData.serviceName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, serviceName: e.target.value });
                      setShowServiceSuggestions(true);
                    }}
                    onFocus={() => setShowServiceSuggestions(true)}
                    placeholder="e.g., General Consultation"
                    autoComplete="off"
                  />
                  {showServiceSuggestions && (
                    <div className="service-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {DOCTOR_SERVICE_OPTIONS
                        .filter(option => 
                          !formData.serviceName || 
                          option.value.toLowerCase().includes(formData.serviceName.toLowerCase()) ||
                          option.description.toLowerCase().includes(formData.serviceName.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              setFormData({ ...formData, serviceName: option.value });
                              setShowServiceSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option.value}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</div>
                          </div>
                        ))}
                      {DOCTOR_SERVICE_OPTIONS.filter(option => 
                        !formData.serviceName || 
                        option.value.toLowerCase().includes(formData.serviceName.toLowerCase()) ||
                        option.description.toLowerCase().includes(formData.serviceName.toLowerCase())
                      ).length === 0 && formData.serviceName && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom service name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <Label htmlFor="doctorRole">Role</Label>
                  <Input
                    id="doctorRole"
                    value={formData.doctorRole || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, doctorRole: e.target.value, doctorName: "", doctorId: null });
                      setShowRoleSuggestions(true);
                    }}
                      onFocus={() => {
                        if (skipRoleSuggestionFocus) {
                          setSkipRoleSuggestionFocus(false);
                          return;
                        }
                        setShowRoleSuggestions(true);
                      }}
                    placeholder="Select role (optional)"
                    autoComplete="off"
                  />
                  {showRoleSuggestions && (
                    <div className="role-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {roles
                        .filter((role: any) => 
                          role.name !== 'patient' && 
                          role.name !== 'admin' &&
                          (!formData.doctorRole || 
                          role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                          role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                        )
                        .map((role: any, index: number) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              setFormData({ ...formData, doctorRole: role.name, doctorName: "", doctorId: null });
                              setShowRoleSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{role.displayName}</div>
                          </div>
                        ))}
                      {roles.filter((role: any) => 
                        role.name !== 'patient' && 
                        role.name !== 'admin' &&
                        (!formData.doctorRole || 
                        role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                        role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                      ).length === 0 && formData.doctorRole && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No roles found. You can enter a custom role name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <Label htmlFor="doctorName">Select Name</Label>
                  <Input
                    id="doctorName"
                    value={formData.doctorName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, doctorName: e.target.value });
                      setShowDoctorSuggestions(true);
                    }}
                    onFocus={() => setShowDoctorSuggestions(true)}
                    placeholder="Select or enter name (optional)"
                    autoComplete="off"
                  />
                  {showDoctorSuggestions && (
                    <div className="doctor-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {filteredUsers
                        .filter((user: any) => {
                          const fullName = `${user.firstName} ${user.lastName}`;
                          return !formData.doctorName || 
                            fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                        })
                        .map((user: any, index: number) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              const fullName = `${user.firstName} ${user.lastName}`;
                              setFormData({ 
                                ...formData, 
                                doctorName: fullName,
                                doctorId: user.id,
                                doctorRole: formData.doctorRole || user.role
                              });
                              setShowDoctorSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>
                          </div>
                        ))}
                      {filteredUsers.filter((user: any) => {
                        const fullName = `${user.firstName} ${user.lastName}`;
                        return !formData.doctorName || 
                          fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No users found. {formData.doctorRole && `Try changing the role filter.`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="serviceCode">Service Code</Label>
                  <Input
                    id="serviceCode"
                    value={formData.serviceCode || ""}
                    onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value })}
                    placeholder="e.g., GC001"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Consultation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "GBP"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="GBP"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {pricingTab === "lab-tests" && !editingItem && (
              <>
                {/* Existing Tests in Database (Read-only) */}
                {labTests.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Existing Tests in Database</Label>
                    <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-sm font-medium">Test Type</th>
                            <th className="text-left p-2 text-sm font-medium">Code</th>
                            <th className="text-left p-2 text-sm font-medium">Category</th>
                            <th className="text-left p-2 text-sm font-medium">Price (£)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labTests.map((test: any) => (
                            <tr key={test.id} className="border-t">
                              <td className="p-2 text-sm">{test.testName}</td>
                              <td className="p-2 text-sm">{test.testCode || '-'}</td>
                              <td className="p-2 text-sm">{test.category || '-'}</td>
                              <td className="p-2 text-sm">{test.basePrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add Custom Tests (Editable) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Add Custom Tests</Label>
                  <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Test Type *</th>
                          <th className="text-left p-2 text-sm font-medium">Code</th>
                          <th className="text-left p-2 text-sm font-medium">Category</th>
                          <th className="text-left p-2 text-sm font-medium">Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  const words = e.target.value.trim().split(/\s+/);
                                  const initials = words.map(word => word.charAt(0).toUpperCase()).join('');
                                  if (initials) {
                                    updated[index].serviceCode = `${initials}001`;
                                  }
                                  
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Complete Blood Count"
                                data-testid={`input-test-name-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., CBC001"
                                data-testid={`input-test-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.category}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].category = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Hematology"
                                data-testid={`input-test-category-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="0.00"
                                data-testid={`input-test-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-test-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-test"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Test
                  </Button>
                  {labTestError && (
                    <p className="text-sm text-red-500 mt-2">{labTestError}</p>
                  )}
                </div>
              </>
            )}

            {pricingTab === "lab-tests" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="testName">Test Name *</Label>
                  <Input
                    id="testName"
                    value={formData.testName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, testName: e.target.value });
                      setShowLabTestSuggestions(true);
                    }}
                    onFocus={() => setShowLabTestSuggestions(true)}
                    placeholder="e.g., Complete Blood Count"
                    autoComplete="off"
                  />
                  {showLabTestSuggestions && (
                    <div className="lab-test-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {LAB_TEST_OPTIONS
                        .filter(option => 
                          !formData.testName || 
                          option.toLowerCase().includes(formData.testName.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              setFormData({ ...formData, testName: option });
                              setShowLabTestSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option}</div>
                          </div>
                        ))}
                      {LAB_TEST_OPTIONS.filter(option => 
                        !formData.testName || 
                        option.toLowerCase().includes(formData.testName.toLowerCase())
                      ).length === 0 && formData.testName && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom test name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="testCode">Test Code</Label>
                  <Input
                    id="testCode"
                    value={formData.testCode || ""}
                    onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                    placeholder="e.g., CBC001"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Hematology"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "USD"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="USD"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {pricingTab === "imaging" && !editingItem && (
              <>
                {/* Existing Imaging in Database (Read-only) */}
                {imaging.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Existing Imaging in Database</Label>
                    <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-sm font-medium">Imaging Type</th>
                            <th className="text-left p-2 text-sm font-medium">Code</th>
                            <th className="text-left p-2 text-sm font-medium">Price (£)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imaging.map((img: any) => (
                            <tr key={img.id} className="border-t">
                              <td className="p-2 text-sm">{img.imagingType}</td>
                              <td className="p-2 text-sm">{img.imagingCode || '-'}</td>
                              <td className="p-2 text-sm">{img.basePrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add Custom Imaging (Editable) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Add Custom Imaging</Label>
                  <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Imaging Type *</th>
                          <th className="text-left p-2 text-sm font-medium">Code</th>
                          <th className="text-left p-2 text-sm font-medium">Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  // Auto-generate code from imaging type
                                  if (e.target.value) {
                                    updated[index].serviceCode = generateImagingCode(e.target.value);
                                  }
                                  
                                  setMultipleServices(updated);
                                  // Clear error when user starts typing
                                  if (imagingError) setImagingError("");
                                }}
                                placeholder="e.g., CT Scan"
                                data-testid={`input-imaging-type-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., CT001"
                                data-testid={`input-imaging-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                  // Clear error when user starts typing
                                  if (imagingError) setImagingError("");
                                }}
                                placeholder="0.00"
                                data-testid={`input-imaging-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-imaging-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-imaging"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Imaging Service
                  </Button>
                  {imagingError && (
                    <p className="text-sm text-red-500 mt-2">{imagingError}</p>
                  )}
                </div>
              </>
            )}

            {pricingTab === "imaging" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="imagingType">Imaging Type *</Label>
                  <Input
                    id="imagingType"
                    value={formData.imagingType || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, imagingType: e.target.value });
                      setShowImagingTypeSuggestions(true);
                    }}
                    onFocus={() => setShowImagingTypeSuggestions(true)}
                    placeholder="Select or type imaging type"
                    autoComplete="off"
                  />
                  {showImagingTypeSuggestions && (
                    <div className="imaging-type-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {IMAGING_TYPE_OPTIONS
                        .filter(option => 
                          !formData.imagingType || 
                          option.toLowerCase().includes(formData.imagingType.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              const generatedCode = generateImagingCode(option);
                              setFormData({ 
                                ...formData, 
                                imagingType: option,
                                imagingCode: generatedCode
                              });
                              setShowImagingTypeSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option}</div>
                          </div>
                        ))}
                      {IMAGING_TYPE_OPTIONS.filter(option => 
                        !formData.imagingType || 
                        option.toLowerCase().includes(formData.imagingType.toLowerCase())
                      ).length === 0 && formData.imagingType && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom imaging type.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="imagingCode">Imaging Code (Auto-generated)</Label>
                  <Input
                    id="imagingCode"
                    value={formData.imagingCode || ""}
                    onChange={(e) => setFormData({ ...formData, imagingCode: e.target.value })}
                    placeholder="Auto-generated when selecting type"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="modality">Modality</Label>
                    <Input
                      id="modality"
                      value={formData.modality || ""}
                      onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                      placeholder="e.g., CT"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bodyPart">Body Part</Label>
                    <Input
                      id="bodyPart"
                      value={formData.bodyPart || ""}
                      onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })}
                      placeholder="e.g., Head"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "USD"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="USD"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

         

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTreatmentsInfoModal} onOpenChange={(open) => {
        if (!open) {
          closeTreatmentsInfoModal();
          return;
        }
        setShowTreatmentsInfoModal(true);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTreatmentInfo ? "Edit Treatment Metadata" : "Create Treatment Metadata"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="treatmentInfoName">Treatment Name</Label>
              <Input
                id="treatmentInfoName"
                value={newTreatmentInfo.name}
                onChange={(e) => setNewTreatmentInfo({ ...newTreatmentInfo, name: e.target.value })}
                placeholder="e.g., Botox"
              />
            </div>
            <div>
              <Label htmlFor="treatmentInfoColor">Color</Label>
              <Input
                id="treatmentInfoColor"
                type="color"
                value={newTreatmentInfo.colorCode}
                onChange={(e) => setNewTreatmentInfo({ ...newTreatmentInfo, colorCode: e.target.value })}
                className="h-10 w-16 p-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTreatmentsInfoModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveTreatmentsInfo} disabled={isSavingTreatmentInfo}>
              {isSavingTreatmentInfo
                ? "Saving..."
                : editingTreatmentInfo
                  ? "Update Treatment"
                  : "Save Treatment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lab Tests Already Exists Modal */}
      <Dialog open={showTestsExistsModal} onOpenChange={setShowTestsExistsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tests Already Exist</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              All default lab tests already exist in the database. No new tests were added.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTestsExistsModal(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imaging Already Exists Modal */}
      <Dialog open={showImagingExistsModal} onOpenChange={setShowImagingExistsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imaging Already Exists</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              All default imaging services already exist in the database. No new imaging was added.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowImagingExistsModal(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Default Doctor Fees Success Modal */}
      <Dialog open={showDefaultFeesSuccessModal} onOpenChange={setShowDefaultFeesSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">{defaultFeesSuccessMessage.title}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              {defaultFeesSuccessMessage.description}
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowDefaultFeesSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Service Names Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Service Name Already Exists</DialogTitle>
            <DialogDescription>
              The following service name(s) already exist in the database:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {duplicateServiceNames.map((name, index) => (
                <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="font-medium text-sm">
                    <span className="text-yellow-800 dark:text-yellow-200">"{name}"</span> already exists in the database
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Would you like to skip these and add only the new service names?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDuplicateDialog(false);
              setDuplicateServiceNames([]);
              setIsSaving(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSkipAndAddOthers} disabled={isSaving}>
              {isSaving ? 'Adding...' : 'Skip & Add Others'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTreatmentDialog} onOpenChange={setShowAddTreatmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTreatment ? "Edit Treatment" : "Add Treatment"}</DialogTitle>
            <DialogDescription>
              {editingTreatment
                ? "Update the treatment details and save the changes."
                : "Save a new treatment so it appears in the Pricing Management grid."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 relative">
                <Label htmlFor="treatmentRole">Role <span className="text-red-500">*</span></Label>
                <Input
                  id="treatmentRole"
                  value={treatmentForm.doctorRole}
                  onChange={(e) => {
                    setTreatmentForm({ ...treatmentForm, doctorRole: e.target.value, doctorName: "", doctorId: null });
                    setShowTreatmentRoleSuggestions(true);
                  }}
                  onClick={() => setShowTreatmentRoleSuggestions(true)}
                  onMouseDown={() => setShowTreatmentRoleSuggestions(true)}
                  placeholder="Select role"
                  autoComplete="off"
                />
                {showTreatmentRoleSuggestions && (
                  <div className="treatment-role-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                    {roles
                      .filter((role: any) => 
                        role.name !== 'patient' && 
                        role.name !== 'admin' &&
                        (!treatmentForm.doctorRole || 
                        role.displayName.toLowerCase().includes(treatmentForm.doctorRole.toLowerCase()) ||
                        role.name.toLowerCase().includes(treatmentForm.doctorRole.toLowerCase()))
                      )
                      .map((role: any, index: number) => (
                        <div
                          key={index}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            setTreatmentForm({ ...treatmentForm, doctorRole: role.name, doctorName: "", doctorId: null });
                            setShowTreatmentRoleSuggestions(false);
                          }}
                        >
                          <div className="font-medium text-sm">{role.displayName}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 relative">
                <Label htmlFor="treatmentDoctorName">Select Name <span className="text-red-500">*</span></Label>
                <Input
                  id="treatmentDoctorName"
                  value={treatmentForm.doctorName}
                  onChange={(e) => {
                    setTreatmentForm({ ...treatmentForm, doctorName: e.target.value, doctorId: null });
                    setShowTreatmentDoctorSuggestions(true);
                  }}
                  onFocus={() => {
                    if (!treatmentForm.doctorRole) {
                      return;
                    }
                    setShowTreatmentDoctorSuggestions(true);
                  }}
                  placeholder={treatmentForm.doctorRole ? "Type to search..." : "Select role first"}
                  autoComplete="off"
                  disabled={!treatmentForm.doctorRole}
                />
                {showTreatmentDoctorSuggestions && (
                  <div className="treatment-doctor-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                    {users
                      .filter((u: any) => {
                        const matchesRole = !treatmentForm.doctorRole || u.role === treatmentForm.doctorRole;
                        const matchesSearch = !treatmentForm.doctorName || 
                          `${u.firstName} ${u.lastName}`.toLowerCase().includes(treatmentForm.doctorName.toLowerCase());
                        return matchesRole && matchesSearch && u.role !== 'patient';
                      })
                      .map((u: any) => (
                        <div
                          key={u.id}
                          className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            setTreatmentForm({ 
                              ...treatmentForm, 
                              doctorName: `${u.firstName} ${u.lastName}`, 
                              doctorId: u.id,
                              doctorRole: u.role // Auto-update role if not set
                            });
                            setShowTreatmentDoctorSuggestions(false);
                          }}
                        >
                          <div className="font-medium text-sm">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-gray-500">{u.role}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="treatment-name">Treatment Name</Label>
              <Select
                value={treatmentForm.treatmentInfoId || ""}
                onValueChange={(value) => {
                  const selected = treatmentsInfoList.find((info: any) => info.id.toString() === value);
                  setTreatmentForm({
                    ...treatmentForm,
                    treatmentInfoId: value,
                    name: selected ? selected.name : "",
                    colorCode: selected ? selected.colorCode : "#000000"
                  });
                }}
                disabled={loadingTreatmentsInfo}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTreatmentsInfo ? "Loading treatments..." : "Select treatment"} />
                </SelectTrigger>
                <SelectContent>
                  {treatmentsInfoList.length === 0 ? (
                    <SelectItem value="no-treatments-configured" disabled>
                      No treatments configured
                    </SelectItem>
                  ) : (
                    treatmentsInfoList.map((info: any) => (
                      <SelectItem key={`treatment-info-${info.id}`} value={info.id.toString()}>
                        <div className="flex items-center justify-between">
                          <span>{info.name}</span>
                          <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: info.colorCode || "#000" }}
                            />
                            {info.colorCode?.toUpperCase()}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="treatment-price">Price (GBP)</Label>
              <Input
                id="treatment-price"
                type="number"
                step="0.01"
                min="0"
                value={treatmentForm.basePrice}
                onChange={(e) => setTreatmentForm({ ...treatmentForm, basePrice: e.target.value })}
                placeholder="e.g. 5.00"
              />
            </div>
            {treatmentError && (
              <p className="text-sm text-red-500">{treatmentError}</p>
            )}
          </div>

          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setShowAddTreatmentDialog(false)} disabled={isSavingTreatment}>
              Cancel
            </Button>
            <Button onClick={handleTreatmentSave} disabled={isSavingTreatment}>
              {isSavingTreatment ? "Saving..." : editingTreatment ? "Save Changes" : "Add New Treatments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteTreatmentDialog}
        onOpenChange={(open) => {
          if (!open) {
            setTreatmentToDelete(null);
          }
          setShowDeleteTreatmentDialog(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Treatment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this treatment?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setShowDeleteTreatmentDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteTreatment}
              data-testid="button-confirm-delete-treatment"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Imaging Confirmation Dialog */}
      <Dialog open={showDeleteAllImagingDialog} onOpenChange={setShowDeleteAllImagingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete All Imaging Pricing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {imaging.length} imaging pricing entries? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteAllImagingDialog(false)}
              disabled={isDeletingAllImaging}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAllImaging}
              disabled={isDeletingAllImaging}
              data-testid="button-confirm-delete-all-imaging"
            >
              {isDeletingAllImaging ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Imaging Progress Dialog */}
      <Dialog open={isDeletingAllImaging} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Deleting Imaging Pricing...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div>
              <div className="flex-1">
                {currentlyDeletingImaging ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Deleting: <span className="font-medium text-gray-900 dark:text-gray-100">{currentlyDeletingImaging}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Preparing to delete imaging entries...
                  </p>
                )}
              </div>
            </div>
            {deleteProgress.total > 0 && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(deleteProgress.current / deleteProgress.total) * 100}%` 
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {deleteProgress.current} of {deleteProgress.total} deleted
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const isDoctor = isDoctorLike(user?.role);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [patientNameFilter, setPatientNameFilter] = useState<string>("");
  const [invoiceIdSearchFilter, setInvoiceIdSearchFilter] = useState<string>("");
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadedInvoiceNumber, setDownloadedInvoiceNumber] = useState("");
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editedStatus, setEditedStatus] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [showSendSuccessModal, setShowSendSuccessModal] = useState(false);
  const [sentInvoiceInfo, setSentInvoiceInfo] = useState({ invoiceNumber: "", recipient: "" });
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [deletedInvoiceNumber, setDeletedInvoiceNumber] = useState("");
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);
  const [isListView, setIsListView] = useState(true);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<
    "Cash" | "Online Payment" | "Insurance" | "Not Selected"
  >("Not Selected");
  const [invoiceStatus, setInvoiceStatus] = useState<"pending" | "paid" | "partial">("pending");
  const [insuranceDetails, setInsuranceDetails] = useState({
    provider: "",
    planType: "",
    policyNumber: "",
    memberNumber: "",
    memberName: "",
    contact: "",
  });
  const [insuranceForm, setInsuranceForm] = useState({
    provider: "",
    planType: "",
    policyNumber: "",
    memberNumber: "",
    memberName: "",
    contact: "",
  });
  const [showInsuranceInfoDialog, setShowInsuranceInfoDialog] = useState(false);
  const [insuranceDialogPromptedFor, setInsuranceDialogPromptedFor] = useState<string | null>(null);

  const insuranceProviders = [
    "NHS (National Health Service)",
    "Bupa",
    "AXA PPP Healthcare",
    "Vitality Health",
    "Aviva Health",
    "Simply Health",
    "WPA",
    "Benenden Health",
    "Healix Health Services",
    "Sovereign Health Care",
    "Exeter Friendly Society",
    "Self-Pay",
    "Other",
  ];

  const insurancePlanTypes = ["Individual", "Family", "Corporate", "Group", "Private"];

  const getPatientInsuranceInfo = (patientId?: string) => {
    if (!patientId || !patients) return null;
    const patient = patients.find((p: any) => p.patientId === patientId);
    if (!patient) return null;
    const info = patient.insuranceInfo || {};
    const provider = info.provider || patient.insuranceProvider || patient.insurance || "";
    if (!provider) return null;
    const memberName =
      info.memberName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
    const contact = info.contact || patient.phone || patient.mobile || patient.contact || "";
    return {
      provider,
      planType: info.planType || "",
      policyNumber: info.policyNumber || patient.insuranceNumber || "",
      memberNumber: info.memberNumber || "",
      memberName,
      contact,
    };
  };

  const openInsuranceDialog = (prefill?: (typeof insuranceDetails)) => {
    setInsuranceForm({
      provider: prefill?.provider || insuranceDetails.provider,
      planType: prefill?.planType || insuranceDetails.planType,
      policyNumber: prefill?.policyNumber || insuranceDetails.policyNumber,
      memberNumber: prefill?.memberNumber || insuranceDetails.memberNumber,
      memberName: prefill?.memberName || insuranceDetails.memberName,
      contact: prefill?.contact || insuranceDetails.contact,
    });
    setShowInsuranceInfoDialog(true);
  };
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const handleInvoicePaymentMethodChange = (newMethod: "Cash" | "Online Payment" | "Insurance" | "Not Selected") => {
    setInvoicePaymentMethod(newMethod);
    if (newMethod === "Cash") {
      setInvoiceStatus("paid");
    } else if (newMethod === "Online Payment") {
      // Online Payment means payment is expected, status will be "pending" or "sent", not "unpaid"
      setInvoiceStatus("pending");
    } else if (newMethod === "Not Selected") {
      // "Not Selected" means no payment method chosen, status will be "unpaid" on server
      setInvoiceStatus("pending"); // Status will be set to "unpaid" on server when payment method is "Not Selected"
    } else {
      setInvoiceStatus("pending");
    }
  };

  const handlePaymentSuccess = async (paidInvoice: Invoice) => {
    try {
      // Update invoice status to "paid" and payment method to "Online Payment" when Stripe payment succeeds
      await apiRequest("PATCH", `/api/billing/invoices/${paidInvoice.id}`, { 
        status: "paid",
        paymentMethod: "Online Payment"
      });
      toast({
        title: "Payment Successful",
        description: `Invoice ${paidInvoice.invoiceNumber} marked as paid.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
    } catch (error) {
      console.error("Failed to update invoice status after payment:", error);
    }
  };
  
  // Date filter states
  const [serviceDateFrom, setServiceDateFrom] = useState("");
  
  // Payment method filter for doctors
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  
  // Insurance provider filter for doctors
  const [insuranceProviderFilter, setInsuranceProviderFilter] = useState<string>("all");
  
  // Universal search for doctors
  const [universalSearch, setUniversalSearch] = useState("");
  
  // Invoice ID filter
  const [invoiceIdFilter, setInvoiceIdFilter] = useState("all");
  
  // Custom Reports filters
  const [reportDateRange, setReportDateRange] = useState("this-month");
  const [reportInsuranceType, setReportInsuranceType] = useState("all");
  const [reportRole, setReportRole] = useState("all");
  const [reportUserName, setReportUserName] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [displayedReportData, setDisplayedReportData] = useState<any>(null);
  
  // Searchable dropdown states
  const [insuranceSearchOpen, setInsuranceSearchOpen] = useState(false);
  const [roleSearchOpen, setRoleSearchOpen] = useState(false);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false);
  const [insuranceSearch, setInsuranceSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("invoices");
  const queryClient = useQueryClient();
  const [isInvoiceSaved, setIsInvoiceSaved] = useState(false);
  const [clinicHeader, setClinicHeader] = useState<any>(null);
  const [clinicFooter, setClinicFooter] = useState<any>(null);
  const [savedInvoiceIds, setSavedInvoiceIds] = useState<Set<number>>(new Set());
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [selectedInvoiceForPdf, setSelectedInvoiceForPdf] = useState<Invoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Insurance claims workflow states
  const [showSubmitClaimDialog, setShowSubmitClaimDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [selectedClaimInvoice, setSelectedClaimInvoice] = useState<Invoice | null>(null);
  const [claimFormData, setClaimFormData] = useState({
    provider: '',
    claimNumber: '',
  });
  const [paymentFormData, setPaymentFormData] = useState({
    amountPaid: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentReference: '',
    notes: '',
  });
  
  // Check if user is admin or patient
  const isAdmin = user?.role === 'admin';
  const isPatient = user?.role === 'patient';
  const canShowNewInvoiceButton = isAdmin || user?.role === 'doctor' || user?.role === 'nurse';

  // Fetch clinic headers and footers from database tables clinic_headers and clinic_footers
  useEffect(() => {
    const fetchClinicBranding = async () => {
      try {
        // Use Promise.allSettled to handle individual failures gracefully
        const [headerResult, footerResult] = await Promise.allSettled([
          apiRequest('GET', '/api/clinic-headers', undefined),
          apiRequest('GET', '/api/clinic-footers', undefined)
        ]);
        
        // Handle header response
        if (headerResult.status === 'fulfilled') {
          const headerResponse = headerResult.value;
          const contentType = headerResponse.headers.get('content-type') || '';
          
          if (headerResponse.ok && contentType.includes('application/json')) {
            try {
              const headerData = await headerResponse.json();
              if (headerData) {
                // Handle array response - get the first active header or first one
                let header = null;
                if (Array.isArray(headerData)) {
                  // Find active header or use first one
                  header = headerData.find((h: any) => h.isActive === true) || headerData[0];
                } else if (typeof headerData === 'object') {
                  // Single object response
                  header = headerData;
                }
                
                if (header) {
                  setClinicHeader(header);
                }
              }
            } catch (jsonError) {
              console.error('Error parsing clinic header JSON:', jsonError);
            }
          }
        }
        
        // Handle footer response
        if (footerResult.status === 'fulfilled') {
          const footerResponse = footerResult.value;
          const contentType = footerResponse.headers.get('content-type') || '';
          
          if (footerResponse.ok && contentType.includes('application/json')) {
            try {
              const footerData = await footerResponse.json();
              if (footerData) {
                // Handle array response - get the first active footer or first one
                let footer = null;
                if (Array.isArray(footerData)) {
                  // Find active footer or use first one
                  footer = footerData.find((f: any) => f.isActive === true) || footerData[0];
                } else if (typeof footerData === 'object') {
                  // Single object response
                  footer = footerData;
                }
                
                if (footer) {
                  setClinicFooter(footer);
                }
              }
            } catch (jsonError) {
              console.error('Error parsing clinic footer JSON:', jsonError);
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching clinic branding:', error);
        // Silently handle errors - clinic branding is optional
      }
    };
    
    // Only fetch for admin/doctor/nurse roles
    if (isAdmin || user?.role === 'doctor' || user?.role === 'nurse') {
    fetchClinicBranding();
    }
  }, [isAdmin, user?.role]);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditedStatus(invoice.status);
    setIsEditingStatus(false);
    setIsInvoiceSaved(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedInvoice || !editedStatus) return;
    
    try {
      await apiRequest('PATCH', `/api/billing/invoices/${selectedInvoice.id}`, {
        status: editedStatus
      });
      
      // If status is changed to "paid", create a payment record
      if (editedStatus === 'paid' && selectedInvoice.status !== 'paid') {
        await apiRequest('POST', '/api/billing/payments', {
          organizationId: selectedInvoice.organizationId,
          invoiceId: selectedInvoice.id,
          patientId: selectedInvoice.patientId,
          amount: typeof selectedInvoice.totalAmount === 'string' ? parseFloat(selectedInvoice.totalAmount) : selectedInvoice.totalAmount,
          currency: 'GBP',
          paymentMethod: 'manual',
          paymentProvider: 'manual',
          paymentStatus: 'completed',
          paymentDate: new Date().toISOString(),
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Refresh payments list
        queryClient.invalidateQueries({ queryKey: ["/api/billing/payments"] });
      }
      
      // Update the local state
      setSelectedInvoice({ ...selectedInvoice, status: editedStatus as any });
      setIsEditingStatus(false);
      
      // Refresh the invoices list
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      
      toast({
        title: "Status Updated",
        description: `Invoice status updated to ${editedStatus}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update invoice status",
        variant: "destructive"
      });
    }
  };

  const handleInlineStatusUpdate = async (invoiceId: string, newStatus: string) => {
    setUpdatingStatusId(invoiceId);
    
    try {
      await apiRequest('PATCH', `/api/billing/invoices/${invoiceId}`, {
        status: newStatus
      });
      
      // Show success modal
      setShowStatusUpdateModal(true);
      
      // Refresh the invoices list
      await queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      await queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update invoice status",
        variant: "destructive"
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleUpdateLineItemQuantity = (lineId: string, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== lineId) return item;
        const quantity = Math.max(1, Number(value) || 1);
        return {
          ...item,
          quantity,
          total: Number((item.unitPrice * quantity).toFixed(2))
        };
      })
    );
  };

  const handleUpdateLineItemUnitPrice = (lineId: string, value: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== lineId) return item;
        if (item.readOnlyPrice) return item;
        const unitPrice = Math.max(0, Number(value) || 0);
        const quantity = Math.max(1, item.quantity);
        return {
          ...item,
          unitPrice,
          total: Number((unitPrice * quantity).toFixed(2))
        };
      })
    );
  };

  const handleRemoveLineItem = (lineId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== lineId));
  };

  const handleCreateInvoice = async () => {
    setIsCreatingInvoice(true);
    setPatientError("");
    setServiceSelectionError("");
    setTotalAmountError("");
    setNhsNumberError("");

    if (!selectedPatient || selectedPatient === 'loading' || selectedPatient === 'no-patients') {
      setPatientError('Please select a patient to bill');
      setIsCreatingInvoice(false);
      return;
    }

    if (lineItems.length === 0) {
      setServiceSelectionError('Add at least one service or procedure to invoice.');
      setIsCreatingInvoice(false);
      return;
    }

    if (!serviceDate || !invoiceDate || !dueDate) {
      setServiceSelectionError('Service date, invoice date, and due date are required.');
      setIsCreatingInvoice(false);
      return;
    }

    const total = lineItems.reduce((acc, item) => acc + item.total, 0);
    if (total <= 0) {
      setTotalAmountError('Total amount must be greater than zero');
      setIsCreatingInvoice(false);
      return;
    }

    if (invoicePaymentMethod === "Insurance" && !insuranceDetails.provider.trim()) {
      toast({
        title: "Missing Insurance Provider",
        description: "Add the insurance provider details before creating the invoice.",
        variant: "destructive"
      });
      openInsuranceDialog();
      setIsCreatingInvoice(false);
      return;
    }

    const resolvedInsuranceProvider =
      invoicePaymentMethod === "Insurance"
        ? insuranceDetails.provider || insuranceProvider
        : insuranceProvider;

    const insuranceSummaryParts: string[] = [];

    if (invoicePaymentMethod === "Insurance") {
      if (insuranceDetails.provider) {
        insuranceSummaryParts.push(`Provider: ${insuranceDetails.provider}`);
      }
      if (insuranceDetails.planType) {
        insuranceSummaryParts.push(`Plan: ${insuranceDetails.planType}`);
      }
      if (insuranceDetails.policyNumber) {
        insuranceSummaryParts.push(`Policy: ${insuranceDetails.policyNumber}`);
      }
      if (insuranceDetails.memberNumber) {
        insuranceSummaryParts.push(`Member #: ${insuranceDetails.memberNumber}`);
      }
      if (insuranceDetails.memberName) {
        insuranceSummaryParts.push(`Member: ${insuranceDetails.memberName}`);
      }
      if (insuranceDetails.contact) {
        insuranceSummaryParts.push(`Contact: ${insuranceDetails.contact}`);
      }
    }

    const insuranceSummary = insuranceSummaryParts.join(' | ');
    const uniqueServiceTypes = Array.from(new Set(lineItems.map((item) => item.serviceType)));
    const serviceTypeField = uniqueServiceTypes.length === 1 ? uniqueServiceTypes[0] : "multiple";
    const serviceIds = lineItems.map((item) => item.serviceId).filter(Boolean) as string[];
    
    // Determine doctor_id: use the first line item's doctorId if available
    // If multiple line items have different doctorIds, use the first one
    const doctorId = lineItems.find((item) => item.doctorId)?.doctorId;

    // Determine payment method: if status will be unpaid, payment method should be "Not Selected"
    // If payment method is "Not Selected", status will be "unpaid" on server
    // "Online Payment" should only be used when payment is actually processed via Stripe
    // If user selected "Online Payment" but invoice is not paid, use "Not Selected" instead
    let finalPaymentMethod = invoicePaymentMethod || "Not Selected";
    
    // If payment method is "Not Selected", ensure it stays that way (status will be unpaid)
    // If payment method is "Online Payment" but invoice is not paid, change to "Not Selected"
    // "Online Payment" should only be set when payment is actually completed via Stripe
    if (!invoicePaymentMethod || invoicePaymentMethod === "Not Selected") {
      finalPaymentMethod = "Not Selected";
    } else if (invoicePaymentMethod === "Online Payment") {
      // "Online Payment" should only be used when payment is actually processed
      // Since we're creating a new invoice, it's not paid yet, so use "Not Selected"
      // The payment method will be updated to "Online Payment" when Stripe payment succeeds
      finalPaymentMethod = "Not Selected";
    }

    const payload = {
      patientId: selectedPatient,
      serviceDate,
      invoiceDate,
      dueDate,
      totalAmount: total.toFixed(2),
      // If payment method is "Not Selected", status will be "unpaid" on server
      // If payment method is "Online Payment", status will be "pending" or "sent"
      paymentMethod: finalPaymentMethod,
      insuranceProvider: resolvedInsuranceProvider,
      nhsNumber: nhsNumber.trim() || undefined,
      notes: [notes, insuranceSummary].filter(Boolean).join(' | '),
      lineItems: lineItems.map((item) => ({
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: Number(item.total.toFixed(2)),
        serviceType: item.serviceType,
        serviceId: item.serviceId
      })),
      serviceType: serviceTypeField,
      serviceIds,
      doctorId: doctorId || undefined
    };

    try {
      const response = await apiRequest('POST', '/api/billing/invoices', payload);
      const responseBody = await response.json();
      const createdInvoice = responseBody.invoice || responseBody;

      setShowNewInvoice(false);
      setSelectedPatient("");
      setServiceDate(new Date().toISOString().split('T')[0]);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setTotalAmount("");
      setInsuranceProvider("");
      setNhsNumber("");
      setNotes("");
      setLineItems([]);
      setSelectedServiceType("appointments");
      setSelectedAppointmentId("");
      setSelectedLabResultId("");
      setSelectedImagingId("");
      setManualServiceEntry({
        code: "",
        description: "",
        quantity: "1",
        unitPrice: ""
      });
      setServiceSelectionError("");
      setInvoicePaymentMethod("Not Selected");
      setInvoiceStatus("pending");
      setInsuranceDetails({
        provider: "",
        planType: "",
        policyNumber: "",
        memberNumber: "",
        memberName: "",
        contact: "",
      });
      setInsuranceDialogPromptedFor(null);

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });

      if (invoicePaymentMethod === "Online Payment") {
        setInvoiceToPay(createdInvoice);
        setShowPaymentModal(true);
      } else {
        setCreatedInvoiceNumber(createdInvoice.invoiceNumber || "");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Invoice creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to create invoice. Please try again.';
      toast({
        title: "Invoice Creation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleInsuranceDialogSave = () => {
    setInsuranceDetails(insuranceForm);
    setShowInsuranceInfoDialog(false);
    setInsuranceDialogPromptedFor(null);

    if (selectedPatient && patients) {
      queryClient.setQueryData(["/api/patients"], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((patient: any) =>
          patient.patientId === selectedPatient
            ? {
                ...patient,
                insuranceInfo: {
                  ...(patient.insuranceInfo || {}),
                  provider: insuranceForm.provider,
                  planType: insuranceForm.planType,
                  policyNumber: insuranceForm.policyNumber,
                  memberNumber: insuranceForm.memberNumber,
                  memberName: insuranceForm.memberName,
                  contact: insuranceForm.contact,
                },
                insuranceProvider: insuranceForm.provider,
                insuranceNumber: insuranceForm.policyNumber,
              }
            : patient
        );
      });
    }
  };

  const handlePayNow = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setShowPaymentModal(true);
  };

  // Insurance claims handlers
  const handleSubmitClaim = (invoice: Invoice) => {
    setSelectedClaimInvoice(invoice);
    setClaimFormData({
      provider: invoice.insurance?.provider || '',
      claimNumber: invoice.insurance?.claimNumber || '',
    });
    setShowSubmitClaimDialog(true);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedClaimInvoice(invoice);
    setPaymentFormData({
      amountPaid: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentReference: '',
      notes: '',
    });
    setShowRecordPaymentDialog(true);
  };

  const submitInsuranceClaim = async () => {
    if (!selectedClaimInvoice) return;

    try {
      await apiRequest('POST', '/api/insurance/submit-claim', {
        invoiceId: selectedClaimInvoice.id,
        provider: claimFormData.provider,
        claimNumber: claimFormData.claimNumber,
      });

      toast({
        title: "Success",
        description: "Insurance claim submitted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setShowSubmitClaimDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit insurance claim",
        variant: "destructive",
      });
    }
  };

  const recordInsurancePayment = async () => {
    if (!selectedClaimInvoice || !paymentFormData.amountPaid) return;

    try {
      await apiRequest('POST', '/api/insurance/record-payment', {
        invoiceId: selectedClaimInvoice.id,
        claimNumber: selectedClaimInvoice.insurance?.claimNumber || '',
        amountPaid: parseFloat(paymentFormData.amountPaid),
        paymentDate: paymentFormData.paymentDate,
        insuranceProvider: selectedClaimInvoice.insurance?.provider || '',
        paymentReference: paymentFormData.paymentReference,
        notes: paymentFormData.notes,
      });

      toast({
        title: "Success",
        description: "Insurance payment recorded successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setShowRecordPaymentDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record insurance payment",
        variant: "destructive",
      });
    }
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    console.log('💾 Save Invoice button clicked for invoice:', invoiceId);
    console.log('📋 Current clinicHeader state:', clinicHeader);
    console.log('📋 Current clinicFooter state:', clinicFooter);
    
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === Number(invoiceId)) : null;
    
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      toast({
        title: "Error",
        description: "Invoice not found",
        variant: "destructive"
      });
      return;
    }

    // Always fetch clinic branding data to ensure we have the latest
    let currentClinicHeader = clinicHeader;
    let currentClinicFooter = clinicFooter;
    
    console.log('🔄 Fetching clinic branding data...');
    try {
      const [headerResult, footerResult] = await Promise.allSettled([
        apiRequest('GET', '/api/clinic-headers', undefined),
        apiRequest('GET', '/api/clinic-footers', undefined)
      ]);
      
      // Handle header response
      if (headerResult.status === 'fulfilled') {
        const headerResponse = headerResult.value;
        console.log('📋 Header response status:', headerResponse.status, headerResponse.ok);
        
        if (headerResponse.ok) {
          try {
            const headerData = await headerResponse.json();
            console.log('📋 Raw header data:', headerData);
            
            if (headerData) {
              let header = null;
              if (Array.isArray(headerData)) {
                header = headerData.find((h: any) => h.isActive === true) || headerData[0];
                console.log('📋 Selected header from array:', header);
              } else if (typeof headerData === 'object') {
                header = headerData;
                console.log('📋 Using header object:', header);
              }
              if (header) {
                currentClinicHeader = header;
                setClinicHeader(header);
                console.log('✅ Clinic header fetched and set:', {
                  clinicName: header.clinicName || header.name,
                  tagline: header.tagline || header.subtitle,
                  hasLogo: !!(header.logoBase64 || header.logoUrl)
                });
              } else {
                console.warn('⚠️ No valid header found in response');
              }
            } else {
              console.warn('⚠️ Header data is null or undefined');
            }
          } catch (jsonError) {
            console.error('❌ Error parsing clinic header JSON:', jsonError);
          }
        } else {
          const errorText = await headerResponse.text().catch(() => '');
          console.error('❌ Header response not OK:', headerResponse.status, errorText);
        }
      } else {
        console.error('❌ Header request failed:', headerResult.reason);
      }
      
      // Handle footer response
      if (footerResult.status === 'fulfilled') {
        const footerResponse = footerResult.value;
        console.log('📋 Footer response status:', footerResponse.status, footerResponse.ok);
        
        if (footerResponse.ok) {
          try {
            const footerData = await footerResponse.json();
            console.log('📋 Raw footer data:', footerData);
            
            if (footerData) {
              let footer = null;
              if (Array.isArray(footerData)) {
                footer = footerData.find((f: any) => f.isActive === true) || footerData[0];
                console.log('📋 Selected footer from array:', footer);
              } else if (typeof footerData === 'object') {
                footer = footerData;
                console.log('📋 Using footer object:', footer);
              }
              if (footer) {
                currentClinicFooter = footer;
                setClinicFooter(footer);
                console.log('✅ Clinic footer fetched and set:', {
                  footerText: footer.footerText || footer.text,
                  disclaimer: footer.disclaimer || footer.copyright
                });
              } else {
                console.warn('⚠️ No valid footer found in response');
              }
            } else {
              console.warn('⚠️ Footer data is null or undefined');
            }
          } catch (jsonError) {
            console.error('❌ Error parsing clinic footer JSON:', jsonError);
          }
        } else {
          const errorText = await footerResponse.text().catch(() => '');
          console.error('❌ Footer response not OK:', footerResponse.status, errorText);
        }
      } else {
        console.error('❌ Footer request failed:', footerResult.reason);
      }
    } catch (error) {
      console.error('❌ Error fetching clinic branding:', error);
    }

    try {
      // Helper to safely convert to number and format
      const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : val;

      // Create PDF document
      console.log('📄 Creating PDF document for save...');
      console.log('📋 Using clinicHeader:', currentClinicHeader);
      console.log('📋 Using clinicFooter:', currentClinicFooter);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Function to add header to page
      // Helper function to auto-adjust font size based on text length and available width
      const getAutoFontSize = (text: string, maxWidth: number, minSize: number = 8, maxSize: number = 24): number => {
        if (!text) return maxSize;
        const textWidth = doc.getTextWidth(text);
        if (textWidth <= maxWidth) return maxSize;
        // Calculate appropriate font size
        const ratio = maxWidth / textWidth;
        const calculatedSize = Math.max(minSize, Math.min(maxSize, maxSize * ratio));
        return Math.floor(calculatedSize);
      };

      const addHeader = () => {
        // Clean white header - no background color
        const headerHeight = 70;
        let logoX = margin;
        let textX = margin;
        const logoSize = 35;
        const lineSpacing = 2;
        
        // Service ID in top left corner
        const serviceId = invoice.serviceId || invoice.service_id || invoice.items?.[0]?.serviceId;
        if (serviceId) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100); // Gray color
          doc.text(String(serviceId), margin, 8);
        }
        
        // Status badge in top right corner
        const invoiceStatus = invoice.status || 'unpaid';
        const statusText = invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1);
        
        // Status badge colors
        let statusBgColor = [220, 38, 38]; // Red for unpaid/overdue
        let statusTextColor = [255, 255, 255]; // White text
        
        if (invoiceStatus === 'paid') {
          statusBgColor = [34, 197, 94]; // Green
        } else if (invoiceStatus === 'partial') {
          statusBgColor = [251, 191, 36]; // Yellow/Amber
        } else if (invoiceStatus === 'cancelled') {
          statusBgColor = [107, 114, 128]; // Gray
        }
        
        // Draw status badge background
        const statusTextWidth = doc.getTextWidth(statusText);
        const badgeWidth = statusTextWidth + 8;
        const badgeHeight = 6;
        const badgeX = pageWidth - margin - badgeWidth;
        const badgeY = 5;
        
        doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
        
        // Status text
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
        doc.text(statusText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1, { align: 'center' });
        
        // Add logo if available from clinic_headers table
        if (currentClinicHeader?.logoBase64 || currentClinicHeader?.logoUrl) {
          try {
            const logoPosition = currentClinicHeader?.logoPosition || 'left';
            let logoData = '';
            let imageFormat = 'PNG';
            
            if (currentClinicHeader.logoBase64) {
              if (currentClinicHeader.logoBase64.includes(',')) {
                logoData = currentClinicHeader.logoBase64;
                const formatMatch = logoData.match(/data:image\/(\w+);base64/);
                if (formatMatch) {
                  imageFormat = formatMatch[1].toUpperCase();
                }
              } else {
                logoData = `data:image/png;base64,${currentClinicHeader.logoBase64}`;
                imageFormat = 'PNG';
              }
            } else if (currentClinicHeader.logoUrl && currentClinicHeader.logoUrl.startsWith('data:')) {
              logoData = currentClinicHeader.logoUrl;
              const formatMatch = logoData.match(/data:image\/(\w+);base64/);
              if (formatMatch) {
                imageFormat = formatMatch[1].toUpperCase();
              }
            }
            
            if (logoData) {
            if (logoPosition === 'left') {
                doc.addImage(logoData, imageFormat, logoX, 10, logoSize, logoSize);
                textX = logoX + logoSize + 7;
            } else if (logoPosition === 'center') {
              const centerX = (pageWidth - logoSize) / 2;
                doc.addImage(logoData, imageFormat, centerX, 10, logoSize, logoSize);
              textX = margin;
            } else {
                logoX = pageWidth - margin - logoSize - 130;
                doc.addImage(logoData, imageFormat, logoX, 10, logoSize, logoSize);
              textX = margin;
              }
            }
          } catch (error) {
            console.error('Error adding logo to invoice PDF:', error);
          }
        }
        
        // Set black text color for header details
        doc.setTextColor(0, 0, 0);
        
        // Clinic name from clinic_headers table - with auto font sizing
        const clinicName = currentClinicHeader?.clinicName || currentClinicHeader?.name || null;
        let currentY = 15;
        const availableWidth = pageWidth - textX - margin - 130; // Reserve space for "INVOICE" text
        
        if (clinicName) {
          const fontSize = getAutoFontSize(clinicName, availableWidth, 14, 22);
          doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'bold');
          doc.setTextColor(66, 133, 244); // Blue color for clinic name
          doc.text(clinicName, textX, currentY, { maxWidth: availableWidth });
          currentY += fontSize * 0.4 + 2;
        }
        
        // Address - on separate line
        if (currentClinicHeader?.address) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0); // Black for details
          doc.text(currentClinicHeader.address, textX, currentY, { maxWidth: availableWidth });
          currentY += 4;
        }
        
        // Phone and Email - on same line with bullet separator
        const contactLine: string[] = [];
        if (currentClinicHeader?.phone) contactLine.push(currentClinicHeader.phone);
        if (currentClinicHeader?.email) contactLine.push(currentClinicHeader.email);
        
        if (contactLine.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const contactText = contactLine.join(' • ');
          doc.text(contactText, textX, currentY, { maxWidth: availableWidth });
          currentY += 4;
        }
        
        // Website - on separate line
        if (currentClinicHeader?.website) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(currentClinicHeader.website, textX, currentY, { maxWidth: availableWidth });
        }
        
        // INVOICE text on right - blue color
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(66, 133, 244); // Blue color for INVOICE
        doc.text('INVOICE', pageWidth - margin - 5, headerHeight / 2 + 8, { align: 'right' });
      };

      // Function to add footer to page
      const addFooter = (pageNum: number) => {
        const footerY = pageHeight - 20;
        console.log('📄 Adding footer at Y position:', footerY, 'Page height:', pageHeight);
        console.log('📋 Footer data:', {
          footerText: currentClinicFooter?.footerText || currentClinicFooter?.text,
          disclaimer: currentClinicFooter?.disclaimer || currentClinicFooter?.copyright
        });
        
        // Footer background
        doc.setFillColor(248, 250, 252);
        doc.rect(0, footerY - 5, pageWidth, 25, 'F');
        
        // Footer line
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        
        // Footer text from clinic_footers table - only if exists in database
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const footerText = currentClinicFooter?.footerText || currentClinicFooter?.text || null;
        console.log('📝 Footer text from database:', footerText, 'Full footer:', currentClinicFooter);
        if (footerText) {
        doc.text(footerText, pageWidth / 2, footerY + 2, { align: 'center' });
        }
        
        // Additional footer information from clinic_footers table - only if exists in database
        const disclaimer = currentClinicFooter?.disclaimer || currentClinicFooter?.copyright || null;
        console.log('📝 Disclaimer from database:', disclaimer);
        if (disclaimer) {
          doc.text(disclaimer, pageWidth / 2, footerY + 8, { align: 'center' });
        }
        
        // Page number
        doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 2, { align: 'right' });
        console.log('✅ Footer added successfully');
      };

      // Start PDF content
      addHeader();
      
      // Adjust starting position based on header height (70) + spacing
      let yPosition = 85;

      // Bill To and Invoice Details section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO', margin, yPosition);
      doc.text('INVOICE DETAILS', pageWidth / 2 + 10, yPosition);
      
      yPosition += 7;
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.patientName, margin, yPosition);
      doc.text(`Invoice Number: ${invoice.invoiceNumber || invoice.id}`, pageWidth / 2 + 10, yPosition);
      
      yPosition += 5;
      doc.setFontSize(9);
      doc.text(`Patient ID: ${invoice.patientId}`, margin, yPosition);
      doc.text(`Invoice Date: ${format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
      
      yPosition += 5;
      doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);

      yPosition += 10;

      // Services table header
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, yPosition, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      yPosition += 6;
      doc.text('Service Description', margin + 2, yPosition);
      doc.text('Qty', pageWidth - margin - 80, yPosition, { align: 'right' });
      doc.text('Rate', pageWidth - margin - 50, yPosition, { align: 'right' });
      doc.text('Amount', pageWidth - margin - 2, yPosition, { align: 'right' });

      yPosition += 5;

      // Services table rows
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      let rowCount = 0;
      invoice.items.forEach((item: any) => {
        if (yPosition > pageHeight - 50) {
          addFooter(1);
          doc.addPage();
          addHeader();
          yPosition = 85;
        }

        if (rowCount % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, yPosition - 4, contentWidth, 10, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.text(item.description, margin + 2, yPosition);
        yPosition += 4;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Professional medical consultation', margin + 2, yPosition);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        yPosition -= 2;
        doc.text(item.quantity.toString(), pageWidth - margin - 80, yPosition, { align: 'right' });
        doc.text(`£${toNum(item.unitPrice || item.amount / (item.quantity || 1)).toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
        doc.text(`£${toNum(item.total || item.amount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
        
        yPosition += 8;
        rowCount++;
      });

      yPosition += 5;

      // Totals section
      const totalsX = pageWidth - margin - 60;
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, yPosition);
      doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 6;
      doc.text('VAT (0%):', totalsX, yPosition);
      doc.text('£0.00', pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 6;
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.5);
      doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Total Amount:', totalsX, yPosition);
      doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

      if (toNum(invoice.paidAmount) > 0) {
        yPosition += 8;
        doc.setFontSize(9);
        doc.setTextColor(5, 150, 105);
        doc.text('Amount Paid:', totalsX, yPosition);
        doc.text(`-£${toNum(invoice.paidAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
        
        yPosition += 8;
        const balanceDue = toNum(invoice.totalAmount) - toNum(invoice.paidAmount);
        doc.setTextColor(balanceDue === 0 ? 5 : 220, balanceDue === 0 ? 150 : 38, balanceDue === 0 ? 105 : 38);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Balance Due:', totalsX, yPosition);
        doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      }

      addFooter(1);

      // Get PDF as base64
      console.log('📤 Converting PDF to base64...');
      const pdfData = doc.output('datauristring').split(',')[1];
      
      // Send to backend
      console.log('📡 Sending PDF to server...');
      const result = await apiRequest('POST', '/api/billing/save-invoice-pdf', {
        invoiceNumber: invoice.invoiceNumber || invoice.id.toString(),
        patientId: invoice.patientId,
        pdfData
      });

      console.log('✅ Invoice saved successfully:', result);

      setIsInvoiceSaved(true);
      setSavedInvoiceIds(prev => new Set(prev).add(Number(invoiceId)));

      toast({
        title: "Success",
        description: `File successfully saved`,
      });

    } catch (error) {
      console.error('❌ Failed to save invoice:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleOpenSavedInvoicePdf = async (invoice: Invoice) => {
    try {
      setPdfLoading(true);
      setSelectedInvoiceForPdf(invoice);
      
      // Build the PDF path: uploads/Invoices/{organization_id}/{patient_id}/{invoice_number}.pdf
      const organizationId = invoice.organizationId || user?.organizationId;
      const patientId = invoice.patientId;
      const invoiceNumber = invoice.invoiceNumber || invoice.id.toString();
      const pdfPath = `/uploads/Invoices/${organizationId}/${patientId}/${invoiceNumber}.pdf`;
      
      console.log('📄 Opening saved invoice PDF from:', pdfPath);
      
      // Fetch the PDF file
      const response = await fetch(pdfPath, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "PDF not found",
            description: "The saved invoice PDF could not be found. Please save the invoice first.",
            variant: "destructive"
          });
          return;
        }
        throw new Error(`Failed to load PDF: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      setPdfViewerUrl(blobUrl);
      setShowPdfViewer(true);
    } catch (error) {
      console.error('❌ Failed to open saved invoice PDF:', error);
      toast({
        title: "Error",
        description: "Failed to open saved invoice PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    console.log('🔽 Download button clicked for invoice:', invoiceId);
    console.log('📋 Current clinicHeader state:', clinicHeader);
    console.log('📋 Current clinicFooter state:', clinicFooter);
    
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === Number(invoiceId)) : null;
    
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      toast({
        title: "Error",
        description: "Invoice not found",
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Invoice found:', invoice);

    // Always fetch clinic branding data to ensure we have the latest
    let currentClinicHeader = clinicHeader;
    let currentClinicFooter = clinicFooter;
    
    console.log('🔄 Fetching clinic branding data...');
    try {
      const [headerResult, footerResult] = await Promise.allSettled([
        apiRequest('GET', '/api/clinic-headers', undefined),
        apiRequest('GET', '/api/clinic-footers', undefined)
      ]);
      
      // Handle header response
      if (headerResult.status === 'fulfilled') {
        const headerResponse = headerResult.value;
        console.log('📋 Header response status:', headerResponse.status, headerResponse.ok);
        
        if (headerResponse.ok) {
          try {
            const headerData = await headerResponse.json();
            console.log('📋 Raw header data:', headerData);
            
            if (headerData) {
              let header = null;
              if (Array.isArray(headerData)) {
                header = headerData.find((h: any) => h.isActive === true) || headerData[0];
                console.log('📋 Selected header from array:', header);
              } else if (typeof headerData === 'object') {
                header = headerData;
                console.log('📋 Using header object:', header);
              }
              if (header) {
                currentClinicHeader = header;
                setClinicHeader(header);
                console.log('✅ Clinic header fetched and set:', {
                  clinicName: header.clinicName || header.name,
                  tagline: header.tagline || header.subtitle,
                  hasLogo: !!(header.logoBase64 || header.logoUrl)
                });
              } else {
                console.warn('⚠️ No valid header found in response');
              }
            } else {
              console.warn('⚠️ Header data is null or undefined');
            }
          } catch (jsonError) {
            console.error('❌ Error parsing clinic header JSON:', jsonError);
          }
        } else {
          const errorText = await headerResponse.text().catch(() => '');
          console.error('❌ Header response not OK:', headerResponse.status, errorText);
        }
      } else {
        console.error('❌ Header request failed:', headerResult.reason);
      }
      
      // Handle footer response
      if (footerResult.status === 'fulfilled') {
        const footerResponse = footerResult.value;
        console.log('📋 Footer response status:', footerResponse.status, footerResponse.ok);
        
        if (footerResponse.ok) {
          try {
            const footerData = await footerResponse.json();
            console.log('📋 Raw footer data:', footerData);
            
            if (footerData) {
              let footer = null;
              if (Array.isArray(footerData)) {
                footer = footerData.find((f: any) => f.isActive === true) || footerData[0];
                console.log('📋 Selected footer from array:', footer);
              } else if (typeof footerData === 'object') {
                footer = footerData;
                console.log('📋 Using footer object:', footer);
              }
              if (footer) {
                currentClinicFooter = footer;
                setClinicFooter(footer);
                console.log('✅ Clinic footer fetched and set:', {
                  footerText: footer.footerText || footer.text,
                  disclaimer: footer.disclaimer || footer.copyright
                });
              } else {
                console.warn('⚠️ No valid footer found in response');
              }
            } else {
              console.warn('⚠️ Footer data is null or undefined');
            }
          } catch (jsonError) {
            console.error('❌ Error parsing clinic footer JSON:', jsonError);
          }
        } else {
          const errorText = await footerResponse.text().catch(() => '');
          console.error('❌ Footer response not OK:', footerResponse.status, errorText);
        }
      } else {
        console.error('❌ Footer request failed:', footerResult.reason);
      }
    } catch (error) {
      console.error('❌ Error fetching clinic branding:', error);
    }

    try {
      // Helper to safely convert to number and format
      const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : val;

      // Create new PDF document
      console.log('📄 Creating PDF document...');
      console.log('📋 Using clinicHeader:', currentClinicHeader);
      console.log('📋 Using clinicFooter:', currentClinicFooter);
      const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

      // Helper function to auto-adjust font size based on text length and available width
    const getAutoFontSize = (text: string, maxWidth: number, minSize: number = 8, maxSize: number = 24): number => {
      if (!text) return maxSize;
      const textWidth = doc.getTextWidth(text);
      if (textWidth <= maxWidth) return maxSize;
      // Calculate appropriate font size
      const ratio = maxWidth / textWidth;
      const calculatedSize = Math.max(minSize, Math.min(maxSize, maxSize * ratio));
      return Math.floor(calculatedSize);
    };

      // Function to add header to page with data from clinic_headers table
    const addHeader = () => {
        // Clean white header - no background color
        const headerHeight = 70;
        let logoX = margin;
        let textX = margin;
        const logoSize = 35;
        const lineSpacing = 2;
        
        // Service ID in top left corner
        const serviceId = invoice.serviceId || invoice.service_id || invoice.items?.[0]?.serviceId;
        if (serviceId) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100); // Gray color
          doc.text(String(serviceId), margin, 8);
        }
        
        // Status badge in top right corner
        const invoiceStatus = invoice.status || 'unpaid';
        const statusText = invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1);
        
        // Status badge colors
        let statusBgColor = [220, 38, 38]; // Red for unpaid/overdue
        let statusTextColor = [255, 255, 255]; // White text
        
        if (invoiceStatus === 'paid') {
          statusBgColor = [34, 197, 94]; // Green
        } else if (invoiceStatus === 'partial') {
          statusBgColor = [251, 191, 36]; // Yellow/Amber
        } else if (invoiceStatus === 'cancelled') {
          statusBgColor = [107, 114, 128]; // Gray
        }
        
        // Draw status badge background
        const statusTextWidth = doc.getTextWidth(statusText);
        const badgeWidth = statusTextWidth + 8;
        const badgeHeight = 6;
        const badgeX = pageWidth - margin - badgeWidth;
        const badgeY = 5;
        
        doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');
        
        // Status text
        doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
        doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
        doc.text(statusText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1, { align: 'center' });
        
        // Add logo if available from clinic_headers table
        if (currentClinicHeader?.logoBase64 || currentClinicHeader?.logoUrl) {
          try {
            const logoPosition = currentClinicHeader?.logoPosition || 'left';
            let logoData = '';
            let imageFormat = 'PNG';
            
            if (currentClinicHeader.logoBase64) {
              if (currentClinicHeader.logoBase64.includes(',')) {
                logoData = currentClinicHeader.logoBase64;
                const formatMatch = logoData.match(/data:image\/(\w+);base64/);
                if (formatMatch) {
                  imageFormat = formatMatch[1].toUpperCase();
                }
              } else {
                logoData = `data:image/png;base64,${currentClinicHeader.logoBase64}`;
                imageFormat = 'PNG';
              }
            } else if (currentClinicHeader.logoUrl && currentClinicHeader.logoUrl.startsWith('data:')) {
              logoData = currentClinicHeader.logoUrl;
              const formatMatch = logoData.match(/data:image\/(\w+);base64/);
              if (formatMatch) {
                imageFormat = formatMatch[1].toUpperCase();
              }
            }
            
            if (logoData) {
              if (logoPosition === 'left') {
                doc.addImage(logoData, imageFormat, logoX, 10, logoSize, logoSize);
                textX = logoX + logoSize + 7;
              } else if (logoPosition === 'center') {
                const centerX = (pageWidth - logoSize) / 2;
                doc.addImage(logoData, imageFormat, centerX, 10, logoSize, logoSize);
                textX = margin;
              } else {
                logoX = pageWidth - margin - logoSize - 130;
                doc.addImage(logoData, imageFormat, logoX, 10, logoSize, logoSize);
                textX = margin;
              }
            }
          } catch (error) {
            console.error('Error adding logo to invoice PDF:', error);
          }
        }
        
        // Set black text color for header details
        doc.setTextColor(0, 0, 0);
        
        // Clinic name from clinic_headers table - with auto font sizing
        const clinicName = currentClinicHeader?.clinicName || currentClinicHeader?.name || null;
        let currentY = 15;
        const availableWidth = pageWidth - textX - margin - 130; // Reserve space for "INVOICE" text
        
        if (clinicName) {
          const fontSize = getAutoFontSize(clinicName, availableWidth, 14, 22);
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(66, 133, 244); // Blue color for clinic name
          doc.text(clinicName, textX, currentY, { maxWidth: availableWidth });
          currentY += fontSize * 0.4 + 2;
        }
        
        // Address - on separate line
        if (currentClinicHeader?.address) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0); // Black for details
          doc.text(currentClinicHeader.address, textX, currentY, { maxWidth: availableWidth });
          currentY += 4;
        }
        
        // Phone and Email - on same line with bullet separator
        const contactLine: string[] = [];
        if (currentClinicHeader?.phone) contactLine.push(currentClinicHeader.phone);
        if (currentClinicHeader?.email) contactLine.push(currentClinicHeader.email);
        
        if (contactLine.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const contactText = contactLine.join(' • ');
          doc.text(contactText, textX, currentY, { maxWidth: availableWidth });
          currentY += 4;
        }
        
        // Website - on separate line
        if (currentClinicHeader?.website) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(currentClinicHeader.website, textX, currentY, { maxWidth: availableWidth });
        }
        
        // INVOICE text on right - blue color
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
        doc.setTextColor(66, 133, 244); // Blue color for INVOICE
        doc.text('INVOICE', pageWidth - margin - 5, headerHeight / 2 + 8, { align: 'right' });
    };

    // Function to add footer to page
    const addFooter = (pageNum: number) => {
      const footerY = pageHeight - 20;
      
      // Footer background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, footerY - 5, pageWidth, 25, 'F');
      
      // Footer line
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      // Footer text from clinic_footers table - only if exists in database
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const footerText = currentClinicFooter?.footerText || currentClinicFooter?.text || null;
      console.log('📝 Download - Footer text from database:', footerText, 'Full footer:', currentClinicFooter);
      if (footerText) {
      doc.text(footerText, pageWidth / 2, footerY + 2, { align: 'center' });
      }
      
      // Additional footer information from clinic_footers table - only if exists in database
      const disclaimer = currentClinicFooter?.disclaimer || currentClinicFooter?.copyright || null;
      console.log('📝 Download - Disclaimer from database:', disclaimer);
      if (disclaimer) {
        doc.text(disclaimer, pageWidth / 2, footerY + 8, { align: 'center' });
      }
      
      // Page number
      doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 2, { align: 'right' });
    };

    // Start PDF content
    addHeader();
    
    // Adjust starting position based on header height (60) + spacing
    let yPosition = 75;

    // Bill To and Invoice Details section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO', margin, yPosition);
    doc.text('INVOICE DETAILS', pageWidth / 2 + 10, yPosition);
    
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.patientName, margin, yPosition);
    doc.text(`Invoice Number: ${invoice.id}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.setFontSize(9);
    doc.text(`Patient ID: ${invoice.patientId}`, margin, yPosition);
    doc.text(`Invoice Date: ${format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.text(`Payment Terms: Net 30`, pageWidth / 2 + 10, yPosition);

    yPosition += 10;

    // Payment Information box
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    yPosition += 5;
    doc.text('Payment Information', margin + 3, yPosition);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Multiple payment options available: Credit Card, Bank Transfer, PayPal, or Cash', margin + 3, yPosition);

    yPosition += 12;

    // Services table header
    doc.setFillColor(79, 70, 229);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    yPosition += 6;
    doc.text('Service Description', margin + 2, yPosition);
    doc.text('Qty', pageWidth - margin - 80, yPosition, { align: 'right' });
    doc.text('Rate', pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.text('Amount', pageWidth - margin - 2, yPosition, { align: 'right' });

    yPosition += 5;

    // Services table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    let rowCount = 0;
    invoice.items.forEach((item: any) => {
      if (yPosition > pageHeight - 50) {
        addFooter(1);
        doc.addPage();
        addHeader();
        yPosition = 85;
      }

      // Alternate row background
      if (rowCount % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPosition - 4, contentWidth, 10, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.text(item.description, margin + 2, yPosition);
      yPosition += 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Professional medical consultation', margin + 2, yPosition);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      yPosition -= 2;
      doc.text(item.quantity.toString(), pageWidth - margin - 80, yPosition, { align: 'right' });
      doc.text(`£${toNum(item.unitPrice || item.amount / (item.quantity || 1)).toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
      doc.text(`£${toNum(item.total || item.amount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 8;
      rowCount++;
    });

    yPosition += 5;

    // Totals section
    const totalsX = pageWidth - margin - 60;
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, yPosition);
    doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    
    yPosition += 6;
    doc.text('VAT (0%):', totalsX, yPosition);
    doc.text('£0.00', pageWidth - margin - 2, yPosition, { align: 'right' });
    
    yPosition += 6;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
    
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Amount:', totalsX, yPosition);
    doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

    if (toNum(invoice.paidAmount) > 0) {
      yPosition += 8;
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text('Amount Paid:', totalsX, yPosition);
      doc.text(`-£${toNum(invoice.paidAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 8;
      const balanceDue = toNum(invoice.totalAmount) - toNum(invoice.paidAmount);
      doc.setTextColor(balanceDue === 0 ? 5 : 220, balanceDue === 0 ? 150 : 38, balanceDue === 0 ? 105 : 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Balance Due:', totalsX, yPosition);
      doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    }

      // Add footer to first (and possibly only) page
      addFooter(1);

      // Save the PDF
      console.log('💾 Saving PDF...');
      doc.save(`invoice-${invoice.invoiceNumber || invoice.id}.pdf`);
      
      console.log('✅ PDF download triggered successfully');
      
      // Show download success modal
      setDownloadedInvoiceNumber(invoice.invoiceNumber || invoiceId);
      setShowDownloadModal(true);
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      const organizationId = user?.organizationId;
      const patientId = invoice.patientId;
      const invoiceNumber = invoice.invoiceNumber;
      
      const pdfPath = `/uploads/Invoices/${organizationId}/${patientId}/${invoiceNumber}.pdf`;
      
      const response = await fetch(pdfPath);
      
      if (!response.ok) {
        throw new Error('PDF file not found on server');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      });
    } catch (error) {
      console.error('❌ Failed to download PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download invoice PDF. Please save the invoice first.",
        variant: "destructive"
      });
    }
  };

  const [sendInvoiceDialog, setSendInvoiceDialog] = useState(false);
  const [invoiceToSend, setInvoiceToSend] = useState<Invoice | null>(null);
  const [sendMethod, setSendMethod] = useState("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // New invoice form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType>("appointments");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedLabResultId, setSelectedLabResultId] = useState("");
  const [selectedImagingId, setSelectedImagingId] = useState("");
  const [manualServiceEntry, setManualServiceEntry] = useState({
    code: "",
    description: "",
    quantity: "1",
    unitPrice: ""
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [serviceSelectionError, setServiceSelectionError] = useState("");
  const [nhsNumber, setNhsNumber] = useState("");
  
  // Validation error states
  const [patientError, setPatientError] = useState("");
  const [totalAmountError, setTotalAmountError] = useState("");
  const [nhsNumberError, setNhsNumberError] = useState("");

  const handleSendInvoice = (invoiceId: string | number) => {
    const normalizedInvoiceId = typeof invoiceId === 'number' ? invoiceId : Number(invoiceId);
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === normalizedInvoiceId) : null;
    if (invoice) {
      setInvoiceToSend(invoice);
      setRecipientEmail(`${invoice.patientName.toLowerCase().replace(' ', '.')}@email.com`);
      setRecipientPhone(`+44 7${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`);
      setRecipientName(invoice.patientName);
      setRecipientAddress(`${Math.floor(Math.random() * 999) + 1} High Street\nLondon\nSW1A 1AA`);
      const totalAmt = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      setCustomMessage(`Dear ${invoice.patientName},\n\nPlease find your invoice for services rendered on ${format(new Date(invoice.dateOfService), 'MMM d, yyyy')}.\n\nTotal Amount: £${totalAmt.toFixed(2)}\nDue Date: ${format(new Date(invoice.dueDate), 'MMM d, yyyy')}\n\nThank you for choosing our healthcare services.`);
      setSendInvoiceDialog(true);
    }
  };

  const confirmSendInvoice = async () => {
    if (!invoiceToSend) return;
    
    try {
      // First, save the PDF if sending via email (so we can attach it)
      if (sendMethod === 'email') {
        console.log('📄 Generating PDF for email attachment...');
        await handleSaveInvoice(invoiceToSend.id.toString());
      }
      
      // Now send the invoice (PDF will be attached automatically by backend)
      await apiRequest('POST', '/api/billing/send-invoice', {
        invoiceId: invoiceToSend.id,
        sendMethod,
        recipientEmail: sendMethod === 'email' ? recipientEmail : undefined,
        recipientPhone: sendMethod === 'sms' ? recipientPhone : undefined,
        recipientName: sendMethod === 'print' ? recipientName : undefined,
        recipientAddress: sendMethod === 'print' ? recipientAddress : undefined,
        customMessage
      });
      
      // Set the success modal info
      setSentInvoiceInfo({
        invoiceNumber: invoiceToSend.invoiceNumber || invoiceToSend.id.toString(),
        recipient: sendMethod === 'email' ? recipientEmail : sendMethod === 'sms' ? recipientPhone : recipientName
      });
      
      // Close send dialog and show success modal
      setSendInvoiceDialog(false);
      setShowSendSuccessModal(true);
      
      // Clear all form fields
      setInvoiceToSend(null);
      setRecipientEmail("");
      setRecipientPhone("");
      setRecipientName("");
      setRecipientAddress("");
      setCustomMessage("");
    } catch (error) {
      toast({
        title: "Failed to Send Invoice",
        description: "There was an error sending the invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === invoiceId) : null;
    if (invoice) {
      setInvoiceToDelete(invoice);
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    
    try {
      // Call API to delete the invoice
      await apiRequest('DELETE', `/api/billing/invoices/${invoiceToDelete.id}`, {});
      
      // Set deleted invoice info for success modal
      setDeletedInvoiceNumber(invoiceToDelete.invoiceNumber || invoiceToDelete.id.toString());
      
      // Close delete confirmation modal
      setShowDeleteModal(false);
      
      // Show success modal
      setShowDeleteSuccessModal(true);
      
      // Clear the invoice to delete
      setInvoiceToDelete(null);
      
      // Refresh invoices list - use correct query keys
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing"] });
    } catch (error) {
      toast({
        title: "Failed to Delete Invoice",
        description: "There was an error deleting the invoice. Please try again.",
        variant: "destructive"
      });
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
    }
  };

  // Fetch regular invoices for non-doctor roles
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/billing/invoices"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/invoices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      return response.json();
    },
    enabled: user?.role !== 'doctor',
  });

  // Fetch doctor-specific invoices with table joins
  const { data: doctorInvoices, isLoading: doctorInvoicesLoading } = useQuery({
    queryKey: ["/api/billing/doctor-invoices"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/doctor-invoices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch doctor invoices');
      return response.json();
    },
    enabled: user?.role === 'doctor',
  });

  // Doctor invoice category tab state
  const [doctorInvoiceTab, setDoctorInvoiceTab] = useState<'overall' | 'appointments' | 'labResults' | 'imaging'>('overall');

  // Get the appropriate invoices based on user role
  const displayInvoices = user?.role === 'doctor' && doctorInvoices 
    ? (doctorInvoiceTab === 'overall' ? doctorInvoices.overall :
       doctorInvoiceTab === 'appointments' ? doctorInvoices.appointments :
       doctorInvoiceTab === 'labResults' ? doctorInvoices.labResults :
       doctorInvoices.imaging)
    : invoices;

  const isLoadingInvoices = user?.role === 'doctor' ? doctorInvoicesLoading : invoicesLoading;

  // Track which invoices have been checked/updated to avoid repeated updates
  const processedOverdueInvoicesRef = React.useRef<Set<number>>(new Set());

  // Auto-update invoice status to "overdue" for admin role when due date is past
  useEffect(() => {
    if (user?.role === 'admin' && displayInvoices && Array.isArray(displayInvoices) && !isLoadingInvoices) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
      
      const overdueUpdates: Array<Promise<void>> = [];
      const newlyProcessed: number[] = [];
      
      displayInvoices.forEach((invoice: any) => {
        // Skip if already processed, paid, or overdue
        if (processedOverdueInvoicesRef.current.has(invoice.id) || invoice.status === 'paid' || invoice.status === 'overdue') {
          return;
        }
        
        // Check if due date is in the past (not equal to today or future)
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          newlyProcessed.push(invoice.id);
          // Update status to overdue
          overdueUpdates.push(
            (async (): Promise<void> => {
              try {
                await apiRequest('PATCH', `/api/billing/invoices/${invoice.id}`, {
              status: 'overdue'
                });
              } catch (error) {
              console.error(`Failed to update invoice ${invoice.id} to overdue:`, error);
              }
            })()
          );
        }
      });
      
      // Execute all updates
      if (overdueUpdates.length > 0) {
        // Mark invoices as processed before making API calls
        newlyProcessed.forEach(id => processedOverdueInvoicesRef.current.add(id));
        
        Promise.all(overdueUpdates).then(() => {
          // Refetch invoices after updates
          queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
        });
      }
    }
  }, [displayInvoices, user?.role, isLoadingInvoices, queryClient]);

  // Check for pending billing code from voice documentation on mount
  useEffect(() => {
    const pendingCodeData = localStorage.getItem('pendingBillingCode');
    if (pendingCodeData) {
      try {
        const codeData = JSON.parse(pendingCodeData);
        
        // Check if code is recent (within last 5 minutes)
        const codeAge = Date.now() - (codeData.timestamp || 0);
        if (codeAge > 5 * 60 * 1000) {
          // Code is too old, remove it
          localStorage.removeItem('pendingBillingCode');
          return;
        }
        
        // Open the new invoice dialog
        setShowNewInvoice(true);
        
        // Add the code as a line item
        const newLineItem: LineItem = {
          id: `pending-${Date.now()}`,
          serviceType: 'other', // Default to 'other' for medical codes
          code: codeData.code,
          description: codeData.description,
          quantity: 1,
          unitPrice: 0, // User will need to set the price
          total: 0,
          readOnlyPrice: false
        };
        
        setLineItems([newLineItem]);
        
        // Show toast notification
        toast({
          title: "Code Added to Invoice",
          description: `${codeData.code} has been added to the invoice form. Please set the price and complete the invoice.`,
        });
        
        // Clear the pending code
        localStorage.removeItem('pendingBillingCode');
      } catch (error) {
        console.error("Error processing pending billing code:", error);
        localStorage.removeItem('pendingBillingCode');
      }
    }
  }, []); // Run only on mount

  // Fetch patients for new invoice dropdown
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/patients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch patients');
      return response.json();
    }
  });

  const { data: billingDoctorsFees = [] } = useQuery({
    queryKey: ["/api/pricing/doctors-fees", "billing"],
    queryFn: () => fetchResource("/api/pricing/doctors-fees"),
    enabled: Boolean(user)
  });
  
  const { data: labTestPricingList = [] } = useQuery({
    queryKey: ["/api/pricing/lab-tests", "billing"],
    queryFn: () => fetchResource("/api/pricing/lab-tests"),
    enabled: Boolean(user)
  });

  const { data: imagingPricingList = [] } = useQuery({
    queryKey: ["/api/pricing/imaging", "billing"],
    queryFn: () => fetchResource("/api/pricing/imaging"),
    enabled: Boolean(user)
  });

  const { data: treatmentsList = [] } = useQuery({
    queryKey: ["/api/pricing/treatments", "billing"],
    queryFn: () => fetchResource("/api/pricing/treatments"),
    enabled: Boolean(user)
  });

  // Fetch appointments, lab results, and medical images for patient/admin/doctor/nurse roles to get provider information and format Service IDs
  const { data: appointmentsData = [] } = useQuery({
    queryKey: ["/api/appointments", "billing-providers"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/appointments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch appointments');
      return response.json();
    },
    enabled: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse',
  });

  const { data: labResultsData = [] } = useQuery({
    queryKey: ["/api/lab-results", "billing-providers"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/lab-results', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch lab results');
      return response.json();
    },
    enabled: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse',
  });

  const { data: medicalImagesData = [] } = useQuery({
    queryKey: ["/api/medical-images", "billing-providers"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/medical-images', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch medical images');
      return response.json();
    },
    enabled: user?.role === 'patient' || user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse',
  });

  // Fetch users to get provider names (for patient and admin roles)
  const { data: usersData = [] } = useQuery({
    queryKey: ["/api/users", "billing-providers"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: user?.role === 'patient' || user?.role === 'admin',
  });

  // Function to get provider information based on serviceType and serviceId
  const getProviderInfo = (invoice: any): { name: string; role?: string } | null => {
    // Only show provider info for patient and admin roles
    if (user?.role !== 'patient' && user?.role !== 'admin') {
      return null;
    }

    // First check if providerName is already enriched from server
    if (invoice.providerName) {
      return { name: invoice.providerName, role: invoice.providerRole };
    }

    // For patient and admin roles: First try to get doctor_id directly from invoices table
    // Handle both camelCase (doctorId) and snake_case (doctor_id)
    const doctorId = invoice.doctorId || invoice.doctor_id;
    if (doctorId && allUsers && allUsers.length > 0) {
      const provider = allUsers.find((u: any) => {
        if (!u || !u.id) return false;
        const userId = Number(u.id);
        const invoiceDoctorId = Number(doctorId);
        // Check both numeric and string comparison
        return userId === invoiceDoctorId || 
               String(u.id) === String(doctorId) ||
               u.id === doctorId;
      });
      if (provider) {
        const firstName = provider.firstName || '';
        const lastName = provider.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const role = provider.role || '';
        if (fullName) {
        return { name: fullName, role };
        }
      }
    }

    // Get serviceType and serviceId from invoice level or first item
    const serviceType = invoice.serviceType || invoice.items?.[0]?.serviceType;
    const serviceId = invoice.serviceId || invoice.items?.[0]?.serviceId || invoice.serviceIds?.[0];

    if (!serviceType || !serviceId) {
      return null;
    }

    // For appointments: get provider_id from appointments table
    if (serviceType === 'appointments') {
      // Find appointment by appointmentId (e.g., APT1769676433356P54AUTO)
      const appointment = appointmentsData.find((apt: any) => 
        apt.appointmentId === serviceId || apt.id?.toString() === serviceId
      );
      if (appointment?.providerId) {
        const provider = usersData.find((u: any) => u.id === appointment.providerId);
        if (provider) {
          const firstName = provider.firstName || '';
          const lastName = provider.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const role = provider.role || '';
          return { name: fullName, role };
        }
      }
    }

    // For lab_results: get doctor_name from lab_results table
    if (serviceType === 'labResults') {
      // Find lab result by testId (e.g., LAB1770092882457O5GW3) or id
      const labResult = labResultsData.find((lr: any) => 
        lr.testId === serviceId || lr.id?.toString() === serviceId
      );
      if (labResult?.doctorName) {
        return { name: labResult.doctorName };
      }
      // Fallback: if doctorName not available, try to get from orderedBy
      if (labResult?.orderedBy) {
        const provider = usersData.find((u: any) => u.id === labResult.orderedBy);
        if (provider) {
          const firstName = provider.firstName || '';
          const lastName = provider.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const role = provider.role || '';
          return { name: fullName, role };
        }
      }
    }

    // For medical_images: get selected_user_id from medical_images table
    if (serviceType === 'imaging') {
      // Find medical image by imageId (e.g., IMG-004) or id
      const medicalImage = medicalImagesData.find((img: any) => 
        img.imageId === serviceId || img.id?.toString() === serviceId
      );
      if (medicalImage?.selectedUserId) {
        const provider = usersData.find((u: any) => u.id === medicalImage.selectedUserId);
        if (provider) {
          const firstName = provider.firstName || '';
          const lastName = provider.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const role = provider.role || '';
          return { name: fullName, role };
        }
      }
    }

    return null;
  };

  // Get the current patient's patientId if user is a patient
  const currentPatient = isPatient && patients ? patients.find((p: any) => p.userId === user?.id) : null;
  const currentPatientId = currentPatient?.patientId;
  const selectedPatientRecord = selectedPatient
    ? patients?.find((p: any) => p.patientId === selectedPatient)
    : null;

  // Fetch all invoices to filter out services that already have invoices
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["/api/billing/invoices", "filter-services"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/invoices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      return response.json();
    },
    enabled: Boolean(selectedPatientRecord?.id)
  });

  // Extract service IDs that already have invoices (paid or unpaid status)
  const invoicedServiceIds = React.useMemo(() => {
    const serviceIds = new Set<string>();
    allInvoices.forEach((invoice: any) => {
      // Check if invoice has paid or unpaid status
      if (invoice.status === 'paid' || invoice.status === 'unpaid' || invoice.status === 'draft') {
        // Check line items for service IDs
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach((item: any) => {
            if (item.serviceId) {
              serviceIds.add(`${item.serviceType || invoice.serviceType || 'appointments'}-${String(item.serviceId)}`);
            }
          });
        }
        // Also check top-level serviceId
        if (invoice.serviceId) {
          serviceIds.add(`${invoice.serviceType || 'appointments'}-${String(invoice.serviceId)}`);
        }
      }
    });
    return serviceIds;
  }, [allInvoices]);

  const { data: patientAppointments = [], isLoading: patientAppointmentsLoading } = useQuery({
    queryKey: ["/api/appointments", selectedPatientRecord?.id],
    queryFn: () => fetchResource(`/api/appointments?patientId=${selectedPatientRecord?.id}`),
    enabled: Boolean(selectedPatientRecord?.id)
  });

  // Filter appointments that don't have invoices yet
  const availableAppointments = React.useMemo(() => {
    return patientAppointments.filter((appointment: any) => {
      // Check both formatted ID (appointmentId) and numeric ID
      const formattedKey = appointment.appointmentId ? `appointments-${appointment.appointmentId}` : null;
      const numericKey = `appointments-${String(appointment.id)}`;
      // Return true if neither key exists in invoicedServiceIds
      return !(formattedKey && invoicedServiceIds.has(formattedKey)) && !invoicedServiceIds.has(numericKey);
    });
  }, [patientAppointments, invoicedServiceIds]);

  const { data: patientLabResults = [], isLoading: patientLabResultsLoading } = useQuery({
    queryKey: ["/api/patients", selectedPatientRecord?.id, "lab-results"],
    queryFn: () => fetchResource(`/api/patients/${selectedPatientRecord?.id}/lab-results`),
    enabled: Boolean(selectedPatientRecord?.id)
  });

  // Filter lab results that don't have invoices yet
  const availableLabResults = React.useMemo(() => {
    return patientLabResults.filter((result: any) => {
      // Check both formatted ID (testId) and numeric ID
      const formattedKey = result.testId ? `labResults-${result.testId}` : null;
      const numericKey = `labResults-${String(result.id)}`;
      // Return true if neither key exists in invoicedServiceIds
      return !(formattedKey && invoicedServiceIds.has(formattedKey)) && !invoicedServiceIds.has(numericKey);
    });
  }, [patientLabResults, invoicedServiceIds]);

  const { data: patientImaging = [], isLoading: patientImagingLoading } = useQuery({
    queryKey: ["/api/patients", selectedPatientRecord?.id, "medical-imaging"],
    queryFn: () => fetchResource(`/api/patients/${selectedPatientRecord?.id}/medical-imaging`),
    enabled: Boolean(selectedPatientRecord?.id)
  });

  // Filter imaging studies that don't have invoices yet
  const availableImaging = React.useMemo(() => {
    return patientImaging.filter((study: any) => {
      // Check both formatted ID (imageId) and numeric ID
      const formattedKey = study.imageId ? `imaging-${study.imageId}` : null;
      const numericKey = `imaging-${String(study.id)}`;
      // Return true if neither key exists in invoicedServiceIds
      return !(formattedKey && invoicedServiceIds.has(formattedKey)) && !invoicedServiceIds.has(numericKey);
    });
  }, [patientImaging, invoicedServiceIds]);

  const { data: treatmentsInfoList = [] } = useQuery({
    queryKey: ["/api/treatments-info", "billing"],
    queryFn: () => fetchResource("/api/treatments-info"),
    enabled: Boolean(user)
  });

  // Fetch users to get provider information (for admin/doctor/nurse roles)
  const { data: usersList = [] } = useQuery({
    queryKey: ["/api/users", "billing-providers"],
    queryFn: () => fetchResource("/api/users"),
    enabled: Boolean(user && (user.role === 'admin' || user.role === 'doctor' || user.role === 'nurse'))
  });

  // Use usersData for patient role, usersList for admin/doctor/nurse
  const allUsers = user?.role === 'patient' ? (usersData || []) : (usersList || []);

  const findDoctorFeeByDoctorId = (doctorId?: number) => {
    if (!doctorId) return null;
    const directMatch = billingDoctorsFees.find((fee: any) => Number(fee.doctorId) === Number(doctorId));
    if (directMatch) return directMatch;
    return billingDoctorsFees.find((fee: any) => !fee.doctorId);
  };

  const findLabPricingForResult = (labResult: any) => {
    if (!labResult) return null;
    const testId = String(labResult.testId || labResult.testType || "").toLowerCase();
    const testName = String(labResult.testName || labResult.testType || "").toLowerCase();
    return labTestPricingList.find((price: any) => {
      const matchesCode = price.testCode && price.testCode.toLowerCase() === testId;
      const matchesName = price.testName && price.testName.toLowerCase() === testName;
      return matchesCode || matchesName;
    }) || null;
  };

  const findImagingPricingForRecord = (record: any) => {
    if (!record) return null;
    const imagingType = String(record.studyType || record.imagingType || "").toLowerCase();
    return imagingPricingList.find((price: any) => price.imagingType && price.imagingType.toLowerCase() === imagingType) || null;
  };

  const findTreatmentById = (treatmentId?: number) => {
    if (!treatmentId) return null;
    return treatmentsList.find((treatment: any) => Number(treatment.id) === Number(treatmentId)) || null;
  };

  const findTreatmentInfoById = (infoId?: number) => {
    if (!infoId) return null;
    return treatmentsInfoList.find((info: any) => Number(info.id) === Number(infoId)) || null;
  };

  const findDoctorFeeByConsultationId = (consultationId?: number) => {
    if (!consultationId) return null;
    return billingDoctorsFees.find((fee: any) => Number(fee.metadata?.consultationId) === Number(consultationId)) || null;
  };

  const handleAddService = useCallback(() => {
    setServiceSelectionError("");

    if (!selectedPatientRecord) {
      setServiceSelectionError("Select a patient before adding services.");
      return;
    }

    const baseQuantity = 1;
    const lineId = `${selectedServiceType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let newItem: LineItem | null = null;
    let providerName: string | undefined = undefined;
    let doctorId: number | undefined = undefined;

    if (selectedServiceType === "appointments") {
      const appointment = availableAppointments.find((apt: any) => String(apt.id) === selectedAppointmentId);
      if (!appointment) {
        setServiceSelectionError("Select a valid appointment for this patient.");
        return;
      }

      // Fetch provider information from appointments table
      if (appointment.providerId) {
        const provider = allUsers.find((u: any) => u.id === appointment.providerId);
        if (provider) {
          providerName = `${provider.firstName} ${provider.lastName}`;
          doctorId = provider.id;
        }
      }

      // For all roles (admin, patient, etc.), set due date and service date to appointment schedule_at date
      // Follow admin strategy: Due date should always be appointment schedule_at date (not current date)
      if (appointment.scheduledAt) {
        const appointmentDate = new Date(appointment.scheduledAt);
        const appointmentDateStr = appointmentDate.toISOString().split('T')[0];
        setDueDate(appointmentDateStr); // Set due date to appointment date
        setServiceDate(appointmentDateStr); // Also set service date to appointment date
      }

      const treatment = findTreatmentById(appointment.treatmentId);
      const treatmentInfo = findTreatmentInfoById(appointment.treatmentId);
      const isTreatment = Boolean(treatment && appointment.treatmentId);

      if (isTreatment && treatment) {
        const amount = Number(treatment.basePrice || 0);
        if (amount <= 0) {
          setServiceSelectionError("The linked treatment does not have a price configured.");
          return;
        }
        newItem = {
          id: lineId,
          serviceType: "appointments",
          serviceId: appointment.appointmentId || String(appointment.id),
          code: treatment.metadata?.code || `T-${treatment.id}`,
          description: treatmentInfo?.name || treatment.name || "Treatment",
          quantity: baseQuantity,
          unitPrice: amount,
          total: amount * baseQuantity,
          readOnlyPrice: true,
          providerName,
          doctorId
        };
      } else {
        let fee = findDoctorFeeByConsultationId(appointment.consultationId);
        if (!fee) {
          fee = findDoctorFeeByDoctorId(appointment.providerId);
        }
        const amount = Number(fee?.basePrice || 0);
        if (!fee || amount <= 0) {
          setServiceSelectionError("No consultation fee is configured for the attending doctor.");
          return;
        }
      newItem = {
          id: lineId,
          serviceType: "appointments",
          serviceId: appointment.appointmentId || String(appointment.id),
        code: appointment.appointmentId || `APT-${appointment.id}`,
        description: appointment.description || appointment.title || "Consultation",
          quantity: baseQuantity,
          unitPrice: amount,
          total: amount * baseQuantity,
          readOnlyPrice: true,
          providerName,
          doctorId
        };
      }

      setSelectedAppointmentId("");
    } else if (selectedServiceType === "labResults") {
      const labResult = availableLabResults.find((result: any) => String(result.id) === selectedLabResultId);
      if (!labResult) {
        setServiceSelectionError("Select a lab result for this patient.");
        return;
      }
      
      // Fetch provider information from lab_results table
      if (labResult.doctorName) {
        // Use doctorName directly if available
        providerName = labResult.doctorName;
        // Try to find doctorId from users if doctorName matches
        if (labResult.orderedBy) {
          doctorId = labResult.orderedBy;
        }
      } else if (labResult.orderedBy) {
        // Fallback to orderedBy user
        const provider = allUsers.find((u: any) => u.id === labResult.orderedBy);
        if (provider) {
          providerName = `${provider.firstName} ${provider.lastName}`;
          doctorId = provider.id;
        }
      }
      
      const pricing = findLabPricingForResult(labResult);
      const amount = Number(pricing?.basePrice || 0);
      if (!pricing || amount <= 0) {
        setServiceSelectionError("Pricing for the selected lab result is unavailable.");
        return;
      }

      newItem = {
        id: lineId,
        serviceType: "labResults",
        serviceId: labResult.testId || String(labResult.id),
        code: pricing.testCode || labResult.testId || "Lab",
        description: labResult.testName || pricing.testName || "Lab Result",
        quantity: baseQuantity,
        unitPrice: amount,
        total: amount * baseQuantity,
        readOnlyPrice: true,
        providerName,
        doctorId
      };

      setSelectedLabResultId("");
    } else if (selectedServiceType === "imaging") {
      const imagingRecord = availableImaging.find((img: any) => String(img.id) === selectedImagingId);
      if (!imagingRecord) {
        setServiceSelectionError("Select an imaging record for this patient.");
        return;
      }
      
      // Fetch provider information from medical_images table
      const providerUserId = imagingRecord.selectedUserId || imagingRecord.uploadedBy;
      if (providerUserId) {
        const provider = allUsers.find((u: any) => u.id === providerUserId);
        if (provider) {
          providerName = `${provider.firstName} ${provider.lastName}`;
          doctorId = provider.id;
        } else if (imagingRecord.radiologist) {
          // Fallback to radiologist name if available
          providerName = imagingRecord.radiologist;
        }
      } else if (imagingRecord.radiologist) {
        // Fallback to radiologist name if no user ID available
        providerName = imagingRecord.radiologist;
      }
      
      const pricing = findImagingPricingForRecord(imagingRecord);
      const amount = Number(pricing?.basePrice || 0);
      if (!pricing || amount <= 0) {
        setServiceSelectionError("Pricing for the selected imaging study is unavailable.");
        return;
      }

      newItem = {
        id: lineId,
        serviceType: "imaging",
        serviceId: imagingRecord.imageId || String(imagingRecord.id),
        code: pricing.imagingCode || imagingRecord.imageId || "Imaging",
        description: imagingRecord.studyType || pricing.imagingType || "Imaging Study",
        quantity: baseQuantity,
        unitPrice: amount,
        total: amount * baseQuantity,
        readOnlyPrice: true,
        providerName,
        doctorId
      };

      setSelectedImagingId("");
    } else if (selectedServiceType === "other") {
      const qty = parseInt(manualServiceEntry.quantity || "1", 10);
      const price = parseFloat(manualServiceEntry.unitPrice || "0");
      if (!manualServiceEntry.code.trim() || !manualServiceEntry.description.trim()) {
        setServiceSelectionError("Enter both code and description for the manual service.");
        return;
      }
      if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
        setServiceSelectionError("Quantity and unit price must be numbers greater than zero.");
        return;
      }

      newItem = {
        id: lineId,
        serviceType: "other",
        code: manualServiceEntry.code.trim(),
        description: manualServiceEntry.description.trim(),
        quantity: qty,
        unitPrice: price,
        total: qty * price,
        readOnlyPrice: false
      };

      setManualServiceEntry({
        code: "",
        description: "",
        quantity: "1",
        unitPrice: ""
      });
    }

    if (newItem) {
      setLineItems((prev) => [...prev, newItem]);
      setServiceSelectionError("");
    }
  }, [
    selectedPatientRecord,
    selectedServiceType,
    availableAppointments,
    availableLabResults,
    availableImaging,
    manualServiceEntry,
    billingDoctorsFees,
    treatmentsInfoList,
    selectedLabResultId,
    selectedImagingId,
    selectedAppointmentId,
    allUsers,
    user?.role
  ]);

  // Auto-populate due date and service date when appointment is selected (for all roles including admin)
  useEffect(() => {
    if (
      selectedServiceType === "appointments" &&
      selectedAppointmentId &&
      availableAppointments.length > 0 &&
      !patientAppointmentsLoading
    ) {
      const appointment = availableAppointments.find((apt: any) => String(apt.id) === selectedAppointmentId);
      if (appointment && appointment.scheduledAt) {
        // Extract date from appointment scheduledAt
        const appointmentDate = new Date(appointment.scheduledAt);
        const appointmentDateStr = appointmentDate.toISOString().split('T')[0];
        // Set due date and service date to appointment schedule_at date (follow admin strategy)
        setDueDate(appointmentDateStr);
        setServiceDate(appointmentDateStr);
      }
    }
  }, [selectedAppointmentId, selectedServiceType, availableAppointments, patientAppointmentsLoading]);

  useEffect(() => {
    if (
      selectedServiceType === "appointments" &&
      selectedAppointmentId &&
      !patientAppointmentsLoading
    ) {
      handleAddService();
    }
  }, [selectedAppointmentId, selectedServiceType, handleAddService, patientAppointmentsLoading]);

  useEffect(() => {
    if (
      selectedServiceType === "labResults" &&
      selectedLabResultId &&
      !patientLabResultsLoading
    ) {
      handleAddService();
    }
  }, [selectedLabResultId, selectedServiceType, handleAddService, patientLabResultsLoading]);

  useEffect(() => {
    if (
      selectedServiceType === "imaging" &&
      selectedImagingId &&
      !patientImagingLoading
    ) {
      handleAddService();
    }
  }, [selectedImagingId, selectedServiceType, handleAddService, patientImagingLoading]);

  // Fetch payments for Payment History tab
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/billing/payments"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/payments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
    enabled: isAdmin,
  });

  // Fetch doctors fees for Revenue Breakdown
  const { data: doctorsFeesForReportsData = [] } = useQuery<any[], Error>({
    queryKey: ["/api/pricing/doctors-fees"],
    enabled: isAdmin && activeTab === "custom-reports"
  });
  const doctorsFeesForReports: any[] = doctorsFeesForReportsData ?? [];
  const doctorsFees: any[] = doctorsFeesForReports;
  
  // Fetch users and roles for Custom Reports filters and provider info
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: (isAdmin && activeTab === "custom-reports") || activeTab === "invoices",
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    select: (data: any) => data || []
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
    enabled: isAdmin && activeTab === "custom-reports",
    select: (data: any) => data || []
  });

  // Auto-populate NHS number when patient is selected
  useEffect(() => {
    if (selectedPatient && patients && patients.length > 0) {
      const selected = patients.find((p: any) => p.patientId === selectedPatient);
      if (selected && selected.nhsNumber) {
        setNhsNumber(selected.nhsNumber);
      } else {
        // Clear NHS number if patient has none or selection is invalid
        setNhsNumber("");
      }
    } else {
      // Clear NHS number when selection is cleared
      setNhsNumber("");
    }
  }, [selectedPatient, patients]);

  useEffect(() => {
    setLineItems([]);
    setSelectedAppointmentId("");
    setSelectedLabResultId("");
    setSelectedImagingId("");
    setManualServiceEntry({
      code: "",
      description: "",
      quantity: "1",
      unitPrice: ""
    });
    setServiceSelectionError("");
  }, [selectedPatient]);

  useEffect(() => {
    const sum = lineItems.reduce((acc, item) => acc + item.total, 0);
    setTotalAmount(sum > 0 ? sum.toFixed(2) : "");
    if (sum > 0) {
      setTotalAmountError("");
    }
  }, [lineItems]);

  useEffect(() => {
    if (invoicePaymentMethod !== "Insurance") {
      setInsuranceDialogPromptedFor(null);
      return;
    }

    if (!selectedPatient) {
      return;
    }

    const patientInsurance = getPatientInsuranceInfo(selectedPatient);

    if (patientInsurance) {
      setInsuranceDetails((prev) => ({
        ...prev,
        ...patientInsurance,
      }));
      setInsuranceDialogPromptedFor(null);
      return;
    }

    if (!insuranceDetails.provider && insuranceDialogPromptedFor !== selectedPatient) {
      openInsuranceDialog({
        provider: "",
        planType: "",
        policyNumber: "",
        memberNumber: "",
        memberName: "",
        contact: "",
      });
      setInsuranceDialogPromptedFor(selectedPatient);
    }
  }, [invoicePaymentMethod, selectedPatient, patients, insuranceDetails.provider, insuranceDialogPromptedFor]);

  const filteredInvoices = Array.isArray(displayInvoices) ? displayInvoices.filter((invoice: any) => {
    // Filter by patient ID if user is a patient
    if (isPatient && currentPatientId) {
      if (invoice.patientId !== currentPatientId) {
        return false;
      }
    }
    
    // For doctors: Universal search across all invoice fields
    if (user?.role === 'doctor' && universalSearch) {
      const searchLower = universalSearch.toLowerCase();
      const matchesUniversalSearch = 
        invoice.patientName?.toLowerCase().includes(searchLower) ||
        String(invoice.id).toLowerCase().includes(searchLower) ||
        String(invoice.invoiceNumber || '').toLowerCase().includes(searchLower) ||
        String(invoice.patientId).toLowerCase().includes(searchLower) ||
        invoice.status?.toLowerCase().includes(searchLower) ||
        String(invoice.totalAmount).includes(searchLower) ||
        String(invoice.paidAmount).includes(searchLower) ||
        invoice.paymentMethod?.toLowerCase().includes(searchLower) ||
        invoice.insurance?.provider?.toLowerCase().includes(searchLower) ||
        invoice.insurance?.claimNumber?.toLowerCase().includes(searchLower) ||
        format(new Date(invoice.dateOfService), 'MMM d, yyyy').toLowerCase().includes(searchLower) ||
        format(new Date(invoice.dueDate), 'MMM d, yyyy').toLowerCase().includes(searchLower);
      
      if (!matchesUniversalSearch) return false;
    }
    
    // For non-doctors: Search by Invoice No. (invoiceNumber) and Patient Name only
    const matchesSearch = !searchQuery || 
      (invoice.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(invoice.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    // Filter by Service Date range - compare date only (ignore time)
    const invoiceServiceDate = new Date(invoice.dateOfService);
    const invoiceDateStr = invoiceServiceDate.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const matchesServiceDateFrom = !serviceDateFrom || invoiceDateStr >= serviceDateFrom;
    
    // Filter by payment method for doctors
    const matchesPaymentMethod = paymentMethodFilter === "all" || 
      invoice.paymentMethod === paymentMethodFilter;
    
    // Filter by insurance provider for doctors
    const matchesInsuranceProvider = insuranceProviderFilter === "all" || 
      invoice.insurance?.provider === insuranceProviderFilter;
    
    // Filter by invoice ID
    const matchesInvoiceId = invoiceIdFilter === "all" || 
      String(invoice.invoiceNumber || invoice.id) === invoiceIdFilter;
    
    // Filter by patient name
    const matchesPatientName = !patientNameFilter || 
      invoice.patientName?.toLowerCase().includes(patientNameFilter.toLowerCase());
    
    // Filter by invoice ID search (searches both invoiceNumber and id)
    const matchesInvoiceIdSearch = !invoiceIdSearchFilter || 
      String(invoice.invoiceNumber || '').toLowerCase().includes(invoiceIdSearchFilter.toLowerCase()) ||
      String(invoice.id).toLowerCase().includes(invoiceIdSearchFilter.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesServiceDateFrom && matchesPaymentMethod && matchesInsuranceProvider && matchesInvoiceId && matchesPatientName && matchesInvoiceIdSearch;
  }) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInsuranceStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'partially_paid': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalRevenue = () => {
    return Array.isArray(payments) ? payments.reduce((sum: number, payment: any) => {
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
      return sum + amount;
    }, 0) : 0;
  };

  const getOutstandingAmount = () => {
    // Calculate total from invoices table
    const totalInvoices = Array.isArray(invoices) ? invoices.reduce((sum: number, invoice: any) => {
      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      return sum + amount;
    }, 0) : 0;
    
    // Calculate total from payments table
    const totalPayments = Array.isArray(payments) ? payments.reduce((sum: number, payment: any) => {
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
      return sum + amount;
    }, 0) : 0;
    
    // Outstanding = Invoices - Payments
    return totalInvoices - totalPayments;
  };

  // Calculate Revenue Breakdown from real data
  const getRevenueBreakdown = (feeList: any[]) => {
    if (!Array.isArray(invoices) || !Array.isArray(feeList)) {
      return [];
    }

    // Get date range based on reportDateRange filter
    const currentDate = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (reportDateRange) {
      case 'today':
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        endDate = new Date(currentDate.setHours(23, 59, 59, 999));
        break;
      case 'this-week':
        const day = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - day);
        endDate = new Date();
        break;
      case 'this-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'last-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        break;
      case 'this-quarter':
        const quarter = Math.floor(currentDate.getMonth() / 3);
        startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
        endDate = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this-year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    const filteredInvoices = invoices.filter((invoice: any) => {
      const invoiceDate = new Date(invoice.dateOfService);
      
      // Date range filter
      const matchesDateRange = invoiceDate >= startDate && invoiceDate <= endDate;
      
      // Insurance type filter
      const matchesInsurance = reportInsuranceType === 'all' || 
        invoice.insurance?.provider === reportInsuranceType ||
        (reportInsuranceType === 'Self-Pay' && (!invoice.insurance || !invoice.insurance.provider));
      
      // Role filter - find user ID from invoices (providerId or userId)
      let matchesRole = reportRole === 'all';
      if (reportRole !== 'all' && users && users.length > 0) {
        const invoiceUser = users.find((u: any) => 
          u.id === invoice.providerId || u.id === invoice.userId
        );
        matchesRole = invoiceUser?.role === reportRole;
      }
      
      // User name filter
      const matchesUser = reportUserName === 'all' || 
        invoice.providerId === parseInt(reportUserName) ||
        invoice.userId === parseInt(reportUserName);
      
      return matchesDateRange && matchesInsurance && matchesRole && matchesUser;
    });

    // Group invoices by service name from doctors fee table
    const serviceMap: Record<string, any> = {};

    filteredInvoices.forEach((invoice: any) => {
      // Try to match invoice service with doctors fee by service name or service type
      const matchingFee = feeList.find((fee: any) => 
        fee.serviceName === invoice.serviceType || 
        fee.serviceName === invoice.serviceId
      );

      const serviceName = matchingFee?.serviceName || invoice.serviceType || 'Other Services';
      
      if (!serviceMap[serviceName]) {
        serviceMap[serviceName] = {
          serviceName,
          procedures: 0,
          revenue: 0,
          insurance: 0,
          selfPay: 0,
          totalAmount: 0,
          paidAmount: 0
        };
      }

      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      const paid = typeof invoice.paidAmount === 'string' ? parseFloat(invoice.paidAmount) : invoice.paidAmount;
      
      serviceMap[serviceName].procedures += 1;
      serviceMap[serviceName].revenue += amount;
      serviceMap[serviceName].totalAmount += amount;
      serviceMap[serviceName].paidAmount += paid;

      // If insurance provider exists, count as insurance, otherwise self-pay
      if (invoice.insuranceProvider && invoice.insuranceProvider !== 'self-pay') {
        serviceMap[serviceName].insurance += amount;
      } else {
        serviceMap[serviceName].selfPay += amount;
      }
    });

    // Convert to array and calculate collection rate
    const breakdown = Object.values(serviceMap).map((service: any) => ({
      ...service,
      collectionRate: service.totalAmount > 0 
        ? Math.round((service.paidAmount / service.totalAmount) * 100)
        : 0
    }));

    // Calculate totals
    const totals = breakdown.reduce((acc, service) => ({
      serviceName: 'Total',
      procedures: acc.procedures + service.procedures,
      revenue: acc.revenue + service.revenue,
      insurance: acc.insurance + service.insurance,
      selfPay: acc.selfPay + service.selfPay,
      totalAmount: acc.totalAmount + service.totalAmount,
      paidAmount: acc.paidAmount + service.paidAmount,
      collectionRate: 0
    }), {
      serviceName: 'Total',
      procedures: 0,
      revenue: 0,
      insurance: 0,
      selfPay: 0,
      totalAmount: 0,
      paidAmount: 0,
      collectionRate: 0
    });

    totals.collectionRate = totals.totalAmount > 0 
      ? Math.round((totals.paidAmount / totals.totalAmount) * 100)
      : 0;

    return [...breakdown, totals];
  };

  // Export Revenue Breakdown as CSV
  const exportRevenueCSV = () => {
    const data = getRevenueBreakdown(doctorsFeesForReports);
    
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No revenue data available to export.",
        variant: "destructive"
      });
      return;
    }

    // Create CSV content
    const headers = ['Service Type', 'Procedures', 'Revenue', 'Insurance', 'Self-Pay', 'Collection Rate'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.serviceName}"`,
        row.procedures,
        row.revenue.toFixed(2),
        row.insurance.toFixed(2),
        row.selfPay.toFixed(2),
        `${row.collectionRate}%`
      ].join(','))
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-breakdown-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: "Revenue breakdown has been exported successfully.",
    });
  };

  // Build comprehensive report dataset with patient and insurance data
  const buildReportDataset = () => {
    // Get filtered invoices
    const currentDate = new Date();
    let startDate: Date, endDate: Date;
    
    switch(reportDateRange) {
      case 'this-week':
        const dayOfWeek = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'this-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'this-quarter':
        const quarter = Math.floor(currentDate.getMonth() / 3);
        startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
        endDate = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this-year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    // Create patient lookup map for insurance data
    const patientMap = new Map();
    if (patients && patients.length > 0) {
      patients.forEach((patient: any) => {
        patientMap.set(patient.patientId, {
          name: `${patient.firstName} ${patient.lastName}`,
          insurance: patient.insuranceProvider || 'Self-Pay',
          insuranceNumber: patient.insuranceNumber || 'N/A',
          phone: patient.phoneNumber || 'N/A',
          email: patient.email || 'N/A'
        });
      });
    }
    
    // Filter invoices based on all criteria
    const filteredInvoices = invoices.filter((invoice: any) => {
      const invoiceDate = new Date(invoice.dateOfService);
      const matchesDateRange = invoiceDate >= startDate && invoiceDate <= endDate;
      
      // Insurance type filter - check both invoice insurance and patient insurance
      let matchesInsurance = reportInsuranceType === 'all';
      if (reportInsuranceType !== 'all') {
        const patientInfo = patientMap.get(invoice.patientId);
        const invoiceInsurance = invoice.insurance?.provider || invoice.insuranceProvider;
        const patientInsurance = patientInfo?.insurance;
        
        if (reportInsuranceType === 'Self-Pay') {
          matchesInsurance = (!invoiceInsurance || invoiceInsurance === 'self-pay' || invoiceInsurance === 'Self-Pay') &&
                            (!patientInsurance || patientInsurance === 'Self-Pay');
        } else {
          matchesInsurance = invoiceInsurance === reportInsuranceType || patientInsurance === reportInsuranceType;
        }
      }
      
      // Role filter
      let matchesRole = reportRole === 'all';
      if (reportRole !== 'all' && users && users.length > 0) {
        const invoiceUser = users.find((u: any) => u.id === invoice.providerId || u.id === invoice.userId);
        matchesRole = invoiceUser?.role === reportRole;
      }
      
      // User name filter
      const matchesUser = reportUserName === 'all' || 
        invoice.providerId === parseInt(reportUserName) ||
        invoice.userId === parseInt(reportUserName);
      
      return matchesDateRange && matchesInsurance && matchesRole && matchesUser;
    });
    
    // Get patient information if specific patient selected
    let selectedPatientInfo = null;
    if (reportUserName !== 'all' && reportRole === 'patient') {
      const selectedUser = users.find((u: any) => String(u.id) === reportUserName);
      if (selectedUser && filteredInvoices.length > 0) {
        const patientId = filteredInvoices[0].patientId;
        const patientData = patientMap.get(patientId);
        selectedPatientInfo = {
          name: `${selectedUser.firstName} ${selectedUser.lastName}`,
          patientId: patientId,
          insurance: patientData?.insurance || 'Self-Pay',
          insuranceNumber: patientData?.insuranceNumber || 'N/A',
          phone: patientData?.phone || 'N/A',
          email: patientData?.email || selectedUser.email || 'N/A'
        };
      }
    }
    
    // Group invoices by service type with detailed information
    const invoicesByService: Record<string, any> = {};
    
    filteredInvoices.forEach((invoice: any) => {
      const matchingFee = doctorsFeesForReports.find((fee: any) => 
        fee.serviceName === invoice.serviceType || fee.serviceName === invoice.serviceId
      );
      const serviceName = matchingFee?.serviceName || invoice.serviceType || 'Other Services';
      
      if (!invoicesByService[serviceName]) {
        invoicesByService[serviceName] = {
          serviceName,
          procedures: 0,
          revenue: 0,
          insurance: 0,
          selfPay: 0,
          totalAmount: 0,
          paidAmount: 0,
          invoices: []
        };
      }
      
      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      const paid = typeof invoice.paidAmount === 'string' ? parseFloat(invoice.paidAmount) : invoice.paidAmount;
      const patientInfo = patientMap.get(invoice.patientId);
      
      invoicesByService[serviceName].procedures += 1;
      invoicesByService[serviceName].revenue += amount;
      invoicesByService[serviceName].totalAmount += amount;
      invoicesByService[serviceName].paidAmount += paid;
      
      if (invoice.insuranceProvider && invoice.insuranceProvider !== 'self-pay') {
        invoicesByService[serviceName].insurance += amount;
      } else {
        invoicesByService[serviceName].selfPay += amount;
      }
      
      // Add detailed invoice info
      invoicesByService[serviceName].invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.dateOfService,
        patientName: invoice.patientName,
        patientInsurance: patientInfo?.insurance || 'Self-Pay',
        amount: amount,
        paid: paid,
        status: invoice.status
      });
    });
    
    return {
      patientInfo: selectedPatientInfo,
      invoicesByService,
      dateRange: { start: startDate, end: endDate },
      filters: {
        insuranceType: reportInsuranceType,
        role: reportRole,
        userName: reportUserName
      }
    };
  };

  // Export Revenue Breakdown as PDF with Professional Layout
  const exportRevenuePDF = () => {
    const reportData = buildReportDataset();
    const data = getRevenueBreakdown(doctorsFeesForReports);
    
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No revenue data available to export.",
        variant: "destructive"
      });
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Cura Brand Colors
    const primaryColor = '#4A7DFF'; // Bluewave
    const accentColor = '#6CFFEB'; // Mint Drift
    const darkGray = '#1F2937';
    const lightGray = '#F3F4F6';
    
    // Helper function to add page footer
    const addFooter = (pageNum: number) => {
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, footerY);
      pdf.text(`Page ${pageNum}`, pageWidth - 30, footerY);
      pdf.text('Cura EMR - Confidential', pageWidth / 2, footerY, { align: 'center' });
    };
    
    let currentPage = 1;
    let yPos = 15;
    
    // ===== HEADER SECTION WITH BRANDING =====
    // Blue header band
    pdf.setFillColor(74, 125, 255); // Primary color
    pdf.rect(0, 0, pageWidth, 35, 'F');
    
    // Company name and report title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CURA EMR', 14, 15);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Custom Revenue Report', 14, 25);
    
    // Report date on right side of header
    pdf.setFontSize(10);
    pdf.text(`Report Period`, pageWidth - 14, 15, { align: 'right' });
    pdf.text(`${format(reportData.dateRange.start, 'MMM d, yyyy')} - ${format(reportData.dateRange.end, 'MMM d, yyyy')}`, pageWidth - 14, 22, { align: 'right' });
    
    // Reset text color
    pdf.setTextColor(0, 0, 0);
    yPos = 45;
    
    // ===== EXECUTIVE SUMMARY SECTION =====
    // Calculate summary metrics
    const totalRow = data.find(row => row.serviceName === 'Total');
    const totalRevenue = totalRow ? totalRow.revenue : 0;
    const totalInsurance = totalRow ? totalRow.insurance : 0;
    const totalSelfPay = totalRow ? totalRow.selfPay : 0;
    const avgCollectionRate = totalRow ? totalRow.collectionRate : 0;
    const totalProcedures = totalRow ? totalRow.procedures : 0;
    
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('EXECUTIVE SUMMARY', 14, yPos);
    yPos += 8;
    
    // Summary boxes
    const boxWidth = (pageWidth - 40) / 4;
    const boxHeight = 22;
    const boxY = yPos;
    
    // Box 1: Total Revenue
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Total Revenue', 14 + boxWidth/2, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(74, 125, 255);
    pdf.text(`£${totalRevenue.toFixed(2)}`, 14 + boxWidth/2, boxY + 15, { align: 'center' });
    
    // Box 2: Procedures
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth + 3, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Total Procedures', 14 + boxWidth*1.5 + 3, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(74, 125, 255);
    pdf.text(String(totalProcedures), 14 + boxWidth*1.5 + 3, boxY + 15, { align: 'center' });
    
    // Box 3: Insurance Revenue
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth*2 + 6, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Insurance', 14 + boxWidth*2.5 + 6, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(108, 255, 235);
    pdf.text(`£${totalInsurance.toFixed(2)}`, 14 + boxWidth*2.5 + 6, boxY + 15, { align: 'center' });
    
    // Box 4: Collection Rate
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth*3 + 9, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Collection Rate', 14 + boxWidth*3.5 + 9, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(67, 160, 71);
    pdf.text(`${avgCollectionRate}%`, 14 + boxWidth*3.5 + 9, boxY + 15, { align: 'center' });
    
    yPos = boxY + boxHeight + 15;
    
    // ===== PATIENT INFORMATION SECTION =====
    if (reportData.patientInfo) {
      pdf.setFillColor(239, 246, 255);
      pdf.roundedRect(14, yPos, pageWidth - 28, 35, 2, 2, 'F');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('PATIENT INFORMATION', 20, yPos + 8);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      
      const col1X = 20;
      const col2X = pageWidth / 2 + 10;
      let infoY = yPos + 16;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Name:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.name, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Patient ID:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.patientId, col2X + 25, infoY);
      
      infoY += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Insurance:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.insurance, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Policy #:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.insuranceNumber, col2X + 25, infoY);
      
      infoY += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Phone:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.phone, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Email:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.email, col2X + 25, infoY);
      
      yPos += 45;
    }
    
    // ===== APPLIED FILTERS SECTION =====
    const hasFilters = reportInsuranceType !== 'all' || reportRole !== 'all' || (reportUserName !== 'all' && !reportData.patientInfo);
    if (hasFilters) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('Applied Filters:', 14, yPos);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      let filterText = [];
      if (reportInsuranceType !== 'all') filterText.push(`Insurance: ${reportInsuranceType}`);
      if (reportRole !== 'all') filterText.push(`Role: ${reportRole}`);
      if (reportUserName !== 'all' && !reportData.patientInfo) {
        const userName = users.find((u: any) => String(u.id) === reportUserName);
        if (userName) filterText.push(`User: ${userName.firstName} ${userName.lastName}`);
      }
      pdf.text(filterText.join(' • '), 14, yPos + 6);
      yPos += 15;
    }
    
    // ===== REVENUE BREAKDOWN TABLE =====
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('REVENUE BREAKDOWN BY SERVICE TYPE', 14, yPos);
    yPos += 5;
    
    // Prepare table data
    const tableData = data.map(row => [
      row.serviceName,
      String(row.procedures),
      `£${row.revenue.toFixed(2)}`,
      `£${row.insurance.toFixed(2)}`,
      `£${row.selfPay.toFixed(2)}`,
      `${row.collectionRate}%`
    ]);
    
    // Use autoTable for professional table layout
    autoTable(pdf, {
      startY: yPos,
      head: [['Service Type', 'Count', 'Total Revenue', 'Insurance', 'Self-Pay', 'Collection Rate']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [74, 125, 255],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55]
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 24 }
      },
      didParseCell: function(data) {
        // Bold and highlight the Total row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.textColor = [31, 41, 55];
        }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data) {
        addFooter(currentPage);
        currentPage++;
      }
    });
    
    // Add footer to first page if table didn't span multiple pages
    if (currentPage === 1) {
      addFooter(1);
    }
    
    // Save the PDF
    const fileName = reportData.patientInfo 
      ? `patient-report-${reportData.patientInfo.patientId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      : `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);

    toast({
      title: "Report Generated",
      description: "Professional revenue report has been downloaded successfully.",
    });
  };

  if (invoicesLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Billing & Payments" 
        subtitle="Manage invoices, payments, and insurance claims"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
            {/* Quick Stats - Admin Only */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(getTotalRevenue())}</p>
                      </div>
                      <PoundSterling className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Outstanding</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(getOutstandingAmount())}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Overdue Invoices</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">2</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">This Month</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">24</p>
                      </div>
                      <CalendarDays className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Patient View: Direct Invoice List */}
            {!isAdmin ? (
              <div className="space-y-4">
                {/* Filters and Actions */}
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {user?.role !== 'patient' && (
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-40" data-testid="select-status-filter">
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {user?.role !== 'patient' && (
                            <Popover open={invoiceSearchOpen} onOpenChange={setInvoiceSearchOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={invoiceSearchOpen}
                                  className="w-64 justify-between"
                                  data-testid="select-invoice-filter"
                                >
                                  {invoiceIdFilter === "all" 
                                    ? "Filter by Invoice Number..." 
                                    : displayInvoices?.find((inv: any) => 
                                        String(inv.invoiceNumber || inv.id) === invoiceIdFilter
                                      )?.invoiceNumber || invoiceIdFilter
                                  }
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                            <PopoverContent className="w-64 p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Search invoice number..." 
                                  value={invoiceSearch}
                                  onValueChange={setInvoiceSearch}
                                />
                                <CommandEmpty>No invoice found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setInvoiceIdFilter("all");
                                      setInvoiceSearchOpen(false);
                                      setInvoiceSearch("");
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        invoiceIdFilter === "all" ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    All Invoices
                                  </CommandItem>
                                  {Array.isArray(displayInvoices) && displayInvoices
                                    .filter((inv: any) => {
                                      const invoiceNumber = inv.invoiceNumber || `INV-${inv.id}`;
                                      return invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase());
                                    })
                                    .map((inv: any) => {
                                      const invoiceNumber = inv.invoiceNumber || `INV-${inv.id}`;
                                      const invoiceValue = String(inv.invoiceNumber || inv.id);
                                      return (
                                        <CommandItem
                                          key={inv.id}
                                          value={invoiceNumber}
                                          onSelect={() => {
                                            setInvoiceIdFilter(invoiceValue);
                                            setInvoiceSearchOpen(false);
                                            setInvoiceSearch("");
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              invoiceIdFilter === invoiceValue ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          {invoiceNumber}
                                        </CommandItem>
                                      );
                                    })
                                  }
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          )}

                          {canShowNewInvoiceButton && (
                            <Button onClick={() => setShowNewInvoice(true)} className="ml-auto flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              New Invoice
                            </Button>
                          )}

                          {user?.role === 'doctor' && (
                            <>
                              <Select value={insuranceProviderFilter} onValueChange={setInsuranceProviderFilter}>
                                <SelectTrigger className="w-52" data-testid="select-insurance-provider-filter">
                                  <SelectValue placeholder="Insurance Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">None (Patient Self-Pay)</SelectItem>
                                  <SelectItem value="NHS">NHS (National Health Service)</SelectItem>
                                  <SelectItem value="Bupa">Bupa</SelectItem>
                                  <SelectItem value="AXA PPP Healthcare">AXA PPP Healthcare</SelectItem>
                                  <SelectItem value="Vitality Health">Vitality Health</SelectItem>
                                  <SelectItem value="Aviva Health">Aviva Health</SelectItem>
                                  <SelectItem value="Simply Health">Simply Health</SelectItem>
                                  <SelectItem value="WPA">WPA</SelectItem>
                                  <SelectItem value="Benenden Health">Benenden Health</SelectItem>
                                  <SelectItem value="Healix Health Services">Healix Health Services</SelectItem>
                                  <SelectItem value="Sovereign Health Care">Sovereign Health Care</SelectItem>
                                  <SelectItem value="Exeter Friendly Society">Exeter Friendly Society</SelectItem>
                                  <SelectItem value="Self-Pay">Self-Pay</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                <SelectTrigger className="w-48" data-testid="select-payment-method-filter">
                                  <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Payment Methods</SelectItem>
                                  <SelectItem value="Cash">Cash</SelectItem>
                                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                                  <SelectItem value="Insurance">Insurance</SelectItem>
                                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="Check">Check</SelectItem>
                                  <SelectItem value="Online Payment">Online Payment</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}

                          {user?.role !== 'patient' && (
                            <div className="flex flex-col gap-1">
                              <Label htmlFor="service-date-from" className="text-xs text-gray-600 dark:text-gray-400">Service Date From</Label>
                              <Input
                                id="service-date-from"
                                type="date"
                                value={serviceDateFrom}
                                onChange={(e) => setServiceDateFrom(e.target.value)}
                                className="h-9 text-sm w-44"
                                data-testid="input-service-date-from"
                              />
                            </div>
                          )}

                          {(serviceDateFrom || invoiceIdFilter !== "all" || (user?.role === 'doctor' && (insuranceProviderFilter !== 'all' || paymentMethodFilter !== 'all' || universalSearch))) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setServiceDateFrom("");
                                setInvoiceIdFilter("all");
                                if (user?.role === 'doctor') {
                                  setInsuranceProviderFilter('all');
                                  setPaymentMethodFilter('all');
                                  setUniversalSearch('');
                                }
                              }}
                              data-testid="button-clear-filters"
                              className="mt-5"
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Clear
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Label htmlFor="list-view-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">List View</Label>
                          <Switch 
                            id="list-view-toggle"
                            checked={isListView} 
                            onCheckedChange={setIsListView}
                            data-testid="switch-list-view"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Doctor-specific category tabs (for non-admin doctors) */}
                {user?.role === 'doctor' && (
                  <Card>
                    <CardContent className="p-4">
                      <Tabs value={doctorInvoiceTab} onValueChange={(value) => setDoctorInvoiceTab(value as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-4 gap-1">
                          <TabsTrigger value="overall" data-testid="tab-doctor-overall">
                            Overall
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.overall?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="appointments" data-testid="tab-doctor-appointments">
                            Appointments
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.appointments?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="labResults" data-testid="tab-doctor-lab-results">
                            Lab Results
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.labResults?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="imaging" data-testid="tab-doctor-imaging">
                            Imaging
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.imaging?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {/* Invoices List */}
                {isListView ? (
                  /* List View - Table Format */
                    <Card className="w-full max-w-full overflow-hidden">
                      <CardContent className="p-0 w-full max-w-full overflow-hidden">
                        <div className="overflow-hidden w-full max-w-full">
                          <table className="w-full table-fixed border-collapse">
                          <colgroup>
                            <col className="w-[8%]" />
                            {user?.role !== 'patient' && <col className="w-[9%]" />}
                            {(user?.role === 'patient' || user?.role === 'admin') && <col className="w-[9%]" />}
                            {user?.role === 'admin' && <col className="w-[8%]" />}
                            <col className="w-[9%]" />
                            <col className="w-[8%]" />
                            {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'patient') && <col className="w-[7%]" />}
                            {isPatient && <col className="w-[9%]" />}
                            <col className="w-[8%]" />
                            <col className="w-[8%]" />
                            <col className="w-[7%]" />
                            <col className="w-[7%]" />
                            <col className="w-[8%]" />
                            <col className="w-[9%]" />
                          </colgroup>
                          <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                              {user?.role !== 'patient' && (
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                              )}
                              {(user?.role === 'patient' || user?.role === 'admin') && (
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Provider/Doctor</th>
                              )}
                              {user?.role === 'admin' && (
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Doctor Name</th>
                              )}
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Payment Method</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Type</th>
                              {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'patient') && (
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service ID</th>
                              )}
                              {isPatient && (
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                              )}
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                              <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredInvoices.map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`invoice-row-${invoice.id}`}>
                                <td 
                                  className="px-0.5 py-1 text-xs font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-primary hover:underline truncate" 
                                  onClick={() => {
                                    const invoiceNum = invoice.invoiceNumber || invoice.id;
                                    
                                    if (user?.role === 'doctor') {
                                      setUniversalSearch(String(invoiceNum));
                                    } else {
                                      setSearchQuery(String(invoiceNum));
                                    }
                                  }}
                                  title={invoice.invoiceNumber || invoice.id}
                                  data-testid="button-invoice-number-list"
                                >
                                  <span className="truncate block">{invoice.invoiceNumber || invoice.id}</span>
                                </td>
                                <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate" title={invoice.patientName}>
                                  {invoice.patientName}
                                </td>
                                {(user?.role === 'patient' || user?.role === 'admin') && (
                                  <td className="px-0.5 py-1 text-xs text-gray-600 dark:text-gray-400">
                                    {(() => {
                                      const providerInfo = getProviderInfo(invoice);
                                      if (providerInfo) {
                                        const displayText = providerInfo.role ? `${providerInfo.name} (${providerInfo.role})` : providerInfo.name;
                                        return (
                                          <div className="truncate" title={displayText}>
                                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">
                                              {providerInfo.name}
                                            </span>
                                            {providerInfo.role && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate block">
                                                {providerInfo.role}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      return <span className="text-gray-400">-</span>;
                                    })()}
                                  </td>
                                )}
                                {user?.role === 'admin' && (
                                  <td className="px-0.5 py-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {(() => {
                                      // Get doctor name from doctor_id in invoices table
                                      if (invoice.doctorId) {
                                        const doctor = allUsers.find((u: any) => u.id === invoice.doctorId);
                                        if (doctor) {
                                          const firstName = doctor.firstName || '';
                                          const lastName = doctor.lastName || '';
                                          const fullName = `${firstName} ${lastName}`.trim();
                                          return <span className="font-medium text-gray-900 dark:text-gray-100 truncate block" title={fullName}>{fullName || '-'}</span>;
                                        }
                                      }
                                      return <span className="text-gray-400">-</span>;
                                    })()}
                                  </td>
                                )}
                                <td className="px-0.5 py-1 text-xs">
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 truncate max-w-full text-xs">
                                    {(() => {
                                      // If status is unpaid and payment method is "Online Payment", show "Not Selected"
                                      // "Online Payment" should only show when payment is actually processed
                                      const paymentMethod = invoice.status === 'unpaid' && invoice.paymentMethod === 'Online Payment' ? 'Not Selected' : (invoice.paymentMethod || 'Not Selected');
                                      return <span className="truncate block" title={paymentMethod}>{paymentMethod}</span>;
                                    })()}
                                  </Badge>
                                </td>
                                <td className="px-0.5 py-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={invoice.serviceType || invoice.serviceName || invoice.items?.[0]?.description || '-'}>
                                  {invoice.serviceType || invoice.serviceName || invoice.items?.[0]?.description || '-'}
                                </td>
                                {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse' || user?.role === 'patient') && (
                                  <td className="px-0.5 py-1 text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                                  {(() => {
                                      // Get service_id directly from invoices table
                                      // Priority: invoice.serviceId (top-level from invoices.service_id column) > invoice.items[0].serviceId
                                      const serviceId = invoice.serviceId || invoice.service_id || invoice.items?.[0]?.serviceId;
                                      const serviceIdStr = serviceId ? String(serviceId) : '-';
                                      // Display the raw service_id from invoices table
                                      return <span className="truncate block" title={serviceIdStr}>{serviceIdStr}</span>;
                                  })()}
                                </td>
                                )}
                                {isPatient && (
                                  <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate" title={invoice.createdAt || invoice.created_at 
                                      ? format(new Date(invoice.createdAt || invoice.created_at), 'MMM d, yyyy HH:mm')
                                      : '-'}>
                                    {invoice.createdAt || invoice.created_at 
                                      ? format(new Date(invoice.createdAt || invoice.created_at), 'MMM d, yyyy HH:mm')
                                      : '-'}
                                  </td>
                                )}
                                <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate" title={format(new Date(invoice.dateOfService), 'MMM d, yyyy')}>
                                  {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}
                                </td>
                                <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate" title={format(new Date(invoice.dueDate), 'MMM d, yyyy')}>
                                  {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                                </td>
                                <td className="px-0.5 py-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title={formatCurrency(invoice.totalAmount)}>
                                  {formatCurrency(invoice.totalAmount)}
                                </td>
                                <td className="px-0.5 py-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate" title={formatCurrency(invoice.totalAmount - invoice.paidAmount)}>
                                  {formatCurrency(invoice.totalAmount - invoice.paidAmount)}
                                </td>
                                <td className="px-0.5 py-1 text-xs">
                                  {user?.role === 'patient' ? (
                                    <Badge className={`${getStatusColor(invoice.status)} truncate max-w-full`}>
                                      <span className="truncate block" title={invoice.status}>{invoice.status}</span>
                                    </Badge>
                                  ) : (
                                    <Select 
                                      value={invoice.status} 
                                      onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                      disabled={updatingStatusId === invoice.id}
                                    >
                                      <SelectTrigger className={`w-full max-w-[90px] h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                        <SelectValue>{invoice.status}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </td>
                                <td className="px-0.5 py-1 text-xs">
                                  <div className="flex items-center gap-0.5">
                                    <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} data-testid="button-view-invoice" title="View" className="h-5 w-5 p-0">
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    {isPatient && (
                                      <>
                                        {savedInvoiceIds.has(invoice.id) && (
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                            data-testid="button-open-saved-invoice-pdf-patient" 
                                            title="Open Invoice PDF"
                                            className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 h-5 w-5 p-0"
                                          >
                                            <FileText className="h-3 w-3" />
                                          </Button>
                                        )}
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleSaveInvoice(invoice.id.toString())} 
                                          data-testid="button-save-invoice-patient" 
                                          title="Save Invoice"
                                          className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 h-5 w-5 p-0"
                                        >
                                          <FileText className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    {savedInvoiceIds.has(invoice.id) && (
                                      <>
                                        {!isPatient && (
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                            data-testid="button-open-saved-invoice-pdf" 
                                            title="Open Saved PDF"
                                            className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 h-5 w-5 p-0"
                                          >
                                            <FileText className="h-3 w-3" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} data-testid="button-download-invoice" title="Download" className="h-5 w-5 p-0">
                                          <Download className="h-3 w-3" />
                                        </Button>
                                        {!isPatient && (
                                          <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice.id)} data-testid="button-send-invoice" title="Send" className="h-5 w-5 p-0">
                                            <Send className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    {!isAdmin && invoice.status !== 'unpaid' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                      <Button 
                                        variant="default" 
                                        size="sm" 
                                        onClick={() => handlePayNow(invoice)}
                                        data-testid="button-pay-now"
                                        style={{ 
                                          backgroundColor: '#4A7DFF',
                                          color: 'white'
                                        }}
                                        title="Pay Now"
                                        className="h-7 px-2 text-xs"
                                      >
                                        <CreditCard className="h-3 w-3 mr-1" />
                                        Pay
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Grid View - Card Format */
                  <div className="space-y-4">
                    {filteredInvoices.map((invoice) => (
                      <Card key={invoice.id} className="hover:shadow-md transition-shadow" data-testid={`invoice-card-${invoice.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{invoice.patientName}</h3>
                                {user?.role === 'patient' ? (
                                  <Badge className={`${getStatusColor(invoice.status)} px-3 py-1`}>
                                    {invoice.status}
                                  </Badge>
                                ) : (
                                  <Select 
                                    value={invoice.status} 
                                    onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                    disabled={updatingStatusId === invoice.id}
                                  >
                                    <SelectTrigger className={`w-32 h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                      <SelectValue>{invoice.status}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unpaid">Unpaid</SelectItem>
                                      <SelectItem value="sent">Sent</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                {invoice.status === 'overdue' && (
                                  <Badge className="bg-red-100 text-red-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                <div>
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Invoice Details</h4>
                                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                    <div>
                                      <strong>Invoice:</strong>{' '}
                                      <button
                                        type="button"
                                        className="font-medium cursor-pointer hover:text-primary hover:underline inline-block"
                                        onClick={() => {
                                          const invoiceNum = invoice.invoiceNumber || invoice.id;
                                          
                                          if (user?.role === 'doctor') {
                                            setUniversalSearch(String(invoiceNum));
                                          } else {
                                            setSearchQuery(String(invoiceNum));
                                          }
                                        }}
                                        title="Click to search this invoice"
                                        data-testid="button-invoice-number-grid"
                                      >
                                        {invoice.invoiceNumber || invoice.id}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <strong>Payment Method:</strong>
                                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                        {(() => {
                                          // If status is unpaid and payment method is "Online Payment", show "Not Selected"
                                          // "Online Payment" should only show when payment is actually processed
                                          if (invoice.status === 'unpaid' && invoice.paymentMethod === 'Online Payment') {
                                            return 'Not Selected';
                                          }
                                          return invoice.paymentMethod || 'Not Selected';
                                        })()}
                                      </Badge>
                                    </div>
                                    <div><strong>Service Date:</strong> {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</div>
                                    <div><strong>Due Date:</strong> {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</div>
                                    {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse') && (() => {
                                      // Get service_id directly from invoices table
                                      // Priority: invoice.serviceId (top-level from invoices.service_id column) > invoice.items[0].serviceId
                                      const serviceId = invoice.serviceId || invoice.service_id || invoice.items?.[0]?.serviceId;
                                      if (!serviceId) return null;
                                      
                                      // Display the raw service_id from invoices table
                                      return (
                                        <div>
                                          <strong>Service ID:</strong>{' '}
                                          <span className="font-mono text-xs">{String(serviceId)}</span>
                                        </div>
                                      );
                                    })()}
                                    {(user?.role === 'patient' || user?.role === 'admin') && (() => {
                                      const providerInfo = getProviderInfo(invoice);
                                      if (providerInfo) {
                                        return (
                                          <div>
                                            <strong>Provider/Doctor:</strong>{' '}
                                            <span>{providerInfo.name}</span>
                                            {providerInfo.role && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize ml-1">
                                                ({providerInfo.role})
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {user?.role === 'admin' && (() => {
                                      // Get doctor name from doctor_id in invoices table
                                      if (invoice.doctorId) {
                                        const doctor = allUsers.find((u: any) => u.id === invoice.doctorId);
                                        if (doctor) {
                                          const firstName = doctor.firstName || '';
                                          const lastName = doctor.lastName || '';
                                          const fullName = `${firstName} ${lastName}`.trim();
                                          return (
                                            <div>
                                              <strong>Doctor Name:</strong>{' '}
                                              <span>{fullName || '-'}</span>
                                            </div>
                                          );
                                        }
                                      }
                                      return (
                                        <div>
                                          <strong>Doctor Name:</strong>{' '}
                                          <span className="text-gray-400">-</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Amount</h4>
                                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                    <div><strong>Total:</strong> {formatCurrency(invoice.totalAmount)}</div>
                                    <div><strong>Paid:</strong> {formatCurrency(invoice.paidAmount)}</div>
                                    <div><strong>Outstanding:</strong> {formatCurrency(invoice.totalAmount - invoice.paidAmount)}</div>
                                  </div>
                                </div>
                                
                                {invoice.insurance && (
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Insurance</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Provider:</strong> {invoice.insurance.provider}</div>
                                      <div><strong>Claim:</strong> {invoice.insurance.claimNumber}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>Status:</strong>
                                        <Badge className={getInsuranceStatusColor(invoice.insurance.status)}>
                                          {invoice.insurance.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Services</h4>
                                <div className="space-y-1">
                                  {invoice.items.slice(0, 2).map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                                      <span>{item.description}</span>
                                      <span>{formatCurrency(item.total || item.amount || item.unitPrice || 0)}</span>
                                    </div>
                                  ))}
                                  {invoice.items.length > 2 && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      +{invoice.items.length - 2} more items
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)} data-testid="button-view-invoice">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {isPatient && (
                                <>
                                  {savedInvoiceIds.has(invoice.id) && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                      data-testid="button-open-saved-invoice-pdf-patient-grid" 
                                      title="Open Invoice PDF"
                                      className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleSaveInvoice(invoice.id.toString())} 
                                    data-testid="button-save-invoice-patient-grid" 
                                    title="Save Invoice"
                                    className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {savedInvoiceIds.has(invoice.id) && (
                                <>
                                  {!isPatient && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                      data-testid="button-open-saved-invoice-pdf-grid" 
                                      title="Open Saved PDF"
                                      className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} data-testid="button-download-invoice">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {!isAdmin && invoice.status !== 'unpaid' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  onClick={() => handlePayNow(invoice)}
                                  data-testid="button-pay-now"
                                  style={{ 
                                    backgroundColor: '#4A7DFF',
                                    color: 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.5rem 1rem',
                                    minWidth: '100px'
                                  }}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay Now
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {filteredInvoices.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="no-invoices-message">
                    <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices found</h3>
                    <p className="text-gray-600 dark:text-gray-300">Try adjusting your search terms or filters</p>
                  </div>
                )}
              </div>
            ) : (
              /* Admin View: Tabs Navigation */
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-1">
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
                  <TabsTrigger value="payment-history">Payment History</TabsTrigger>
                  <TabsTrigger value="insurance-claims">Insurance Claims</TabsTrigger>
                  <TabsTrigger value="custom-reports">Custom Reports</TabsTrigger>
                  {isAdmin && <TabsTrigger value="pricing-management">Pricing Management</TabsTrigger>}
                </TabsList>

                <TabsContent value="invoices" className="space-y-4 mt-6 w-full max-w-full overflow-hidden">
                  {/* Filters and Actions */}
                  <Card className="w-full max-w-full overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="text"
                                placeholder="Search by patient name"
                                value={patientNameFilter}
                                onChange={(e) => setPatientNameFilter(e.target.value)}
                                className="pl-9 w-56 h-9 text-sm"
                                data-testid="input-patient-name-filter"
                              />
                            </div>

                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="text"
                                placeholder="Search by invoice ID"
                                value={invoiceIdSearchFilter}
                                onChange={(e) => setInvoiceIdSearchFilter(e.target.value)}
                                className="pl-9 w-56 h-9 text-sm"
                                data-testid="input-invoice-id-filter"
                              />
                            </div>

                            {user?.role === 'doctor' && (
                              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                <SelectTrigger className="w-52">
                                  <SelectValue placeholder="Filter by payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Payment Methods</SelectItem>
                                  <SelectItem value="None (Patient Self-Pay)">None (Patient Self-Pay)</SelectItem>
                                  <SelectItem value="NHS (National Health Service)">NHS (National Health Service)</SelectItem>
                                  <SelectItem value="Bupa">Bupa</SelectItem>
                                  <SelectItem value="AXA PPP Healthcare">AXA PPP Healthcare</SelectItem>
                                  <SelectItem value="Vitality Health">Vitality Health</SelectItem>
                                  <SelectItem value="Aviva Health">Aviva Health</SelectItem>
                                  <SelectItem value="Simply Health">Simply Health</SelectItem>
                                  <SelectItem value="WPA">WPA</SelectItem>
                                  <SelectItem value="Benenden Health">Benenden Health</SelectItem>
                                  <SelectItem value="Healix Health Services">Healix Health Services</SelectItem>
                                  <SelectItem value="Sovereign Health Care">Sovereign Health Care</SelectItem>
                                  <SelectItem value="Exeter Friendly Society">Exeter Friendly Society</SelectItem>
                                  <SelectItem value="Self-Pay">Self-Pay</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            )}

                            <div className="flex flex-col gap-1">
                              <Label htmlFor="admin-service-date-from" className="text-xs text-gray-600 dark:text-gray-400">Service Date From</Label>
                              <Input
                                id="admin-service-date-from"
                                type="date"
                                value={serviceDateFrom}
                                onChange={(e) => setServiceDateFrom(e.target.value)}
                                className="h-9 text-sm w-44"
                                data-testid="input-admin-service-date-from"
                              />
                            </div>

                            {(serviceDateFrom || patientNameFilter || invoiceIdSearchFilter) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setServiceDateFrom("");
                                  setPatientNameFilter("");
                                  setInvoiceIdSearchFilter("");
                                }}
                                data-testid="button-admin-clear-filters"
                                className="mt-5"
                              >
                                <Filter className="h-4 w-4 mr-2" />
                                Clear
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="admin-list-view-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">List View</Label>
                              <Switch 
                                id="admin-list-view-toggle"
                                checked={isListView} 
                                onCheckedChange={setIsListView}
                                data-testid="switch-admin-list-view"
                              />
                            </div>
                            <div className="ml-auto">
                              {canShowNewInvoiceButton && (
                                <Button onClick={() => setShowNewInvoice(true)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  New Invoice
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Doctor-specific category tabs */}
                  {user?.role === 'doctor' && (
                    <Card>
                      <CardContent className="p-4">
                        <Tabs value={doctorInvoiceTab} onValueChange={(value) => setDoctorInvoiceTab(value as any)} className="w-full">
                          <TabsList className="grid w-full grid-cols-4 gap-1">
                            <TabsTrigger value="overall" data-testid="tab-doctor-overall">
                              Overall
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.overall?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="appointments" data-testid="tab-doctor-appointments">
                              Appointments
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.appointments?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="labResults" data-testid="tab-doctor-lab-results">
                              Lab Results
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.labResults?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="imaging" data-testid="tab-doctor-imaging">
                              Imaging
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.imaging?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardContent>
                    </Card>
                  )}

                  {/* Invoices List */}
                  {isListView ? (
                    /* List View - Table Format */
                    <Card>
                      <CardContent className="p-0">
                        <div className="overflow-hidden w-full">
                          <table className="w-full">
                            <colgroup>
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '8%' }} />
                              {isAdmin && <col style={{ width: '8%' }} />}
                              {isPatient && <col style={{ width: '9%' }} />}
                              <col style={{ width: '9%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '7%' }} />
                              <col style={{ width: '8%' }} />
                              <col style={{ width: '9%' }} />
                            </colgroup>
                            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service ID</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Doctor Name</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Type</th>
                                {isAdmin && (
                                  <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Created By</th>
                                )}
                                {isPatient && (
                                  <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Created At</th>
                                )}
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Payment Method</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-0.5 py-1 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {filteredInvoices.map((invoice) => {
                                // Get doctor name from doctor_id (handle both camelCase and snake_case)
                                const doctorName = (() => {
                                  // Check both doctorId and doctor_id
                                  const doctorId = invoice.doctorId || invoice.doctor_id;
                                  
                                  if (doctorId && allUsers && allUsers.length > 0) {
                                    // Try to find doctor by ID (handle both string and number)
                                    const doctor = allUsers.find((u: any) => {
                                      if (!u || !u.id) return false;
                                      const userId = Number(u.id);
                                      const invoiceDoctorId = Number(doctorId);
                                      // Check both numeric and string comparison
                                      return userId === invoiceDoctorId || 
                                             String(u.id) === String(doctorId) ||
                                             u.id === doctorId;
                                    });
                                    
                                    if (doctor) {
                                      const firstName = doctor.firstName || '';
                                      const lastName = doctor.lastName || '';
                                      const fullName = `${firstName} ${lastName}`.trim();
                                      if (fullName) {
                                        return fullName;
                                      }
                                    }
                                  }
                                  
                                  // Fallback: try to get from provider info function
                                  const providerInfo = getProviderInfo(invoice);
                                  return providerInfo?.name || '-';
                                })();
                                
                                // Get service type (check both camelCase and snake_case)
                                let serviceType = invoice.serviceType || invoice.service_type || invoice.items?.[0]?.serviceType || invoice.items?.[0]?.service_type || 'other';
                                
                                // Normalize service type to match SERVICE_TYPE_LABELS keys
                                // Database might have "appointments" but we need to ensure it matches the key format
                                if (serviceType && serviceType !== 'other') {
                                  // Convert common variations to match our ServiceType keys
                                  const normalizedType = serviceType.toLowerCase().trim();
                                  
                                  // Map database values to ServiceType keys
                                  if (normalizedType === 'appointments' || normalizedType === 'appointment' || normalizedType === 'consultation') {
                                    serviceType = 'appointments';
                                  } else if (normalizedType === 'labresults' || normalizedType === 'lab_results' || normalizedType === 'lab result' || normalizedType === 'lab') {
                                    serviceType = 'labResults';
                                  } else if (normalizedType === 'imaging' || normalizedType === 'medical_images' || normalizedType === 'medical image' || normalizedType === 'image') {
                                    serviceType = 'imaging';
                                  } else if (normalizedType === 'other' || normalizedType === 'multiple') {
                                    serviceType = 'other';
                                  }
                                  // If it doesn't match any known type, keep the original value
                                }
                                
                                const serviceTypeLabel = SERVICE_TYPE_LABELS[serviceType as ServiceType] || serviceType;
                                
                                // Get created by user name (for admin role)
                                const createdByName = (() => {
                                  if (!isAdmin) return null;
                                  // Check both camelCase (createdBy) and snake_case (created_by)
                                  const createdById = invoice.createdBy || invoice.created_by;
                                  if (createdById && allUsers && allUsers.length > 0) {
                                    const creator = allUsers.find((u: any) => {
                                      if (!u || !u.id) return false;
                                      const userId = Number(u.id);
                                      const invoiceCreatedById = Number(createdById);
                                      // Check both numeric and string comparison
                                      return userId === invoiceCreatedById || 
                                             String(u.id) === String(createdById) ||
                                             u.id === createdById;
                                    });
                                    if (creator) {
                                      const firstName = creator.firstName || '';
                                      const lastName = creator.lastName || '';
                                      const fullName = `${firstName} ${lastName}`.trim();
                                      if (fullName) {
                                        return fullName;
                                      }
                                    }
                                  }
                                  return '-';
                                })();
                                
                                return (
                                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`invoice-row-${invoice.id}`}>
                                  <td className="px-0.5 py-1 text-xs font-medium text-gray-900 dark:text-gray-100 truncate" title={invoice.invoiceNumber || invoice.id}>
                                    <span className="truncate block">{invoice.invoiceNumber || invoice.id}</span>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {(() => {
                                      // Get service_id directly from invoices table
                                      // Priority: invoice.serviceId (top-level from invoices.service_id column) > invoice.items[0].serviceId
                                      const serviceId = invoice.serviceId || invoice.service_id || invoice.items?.[0]?.serviceId;
                                      const serviceIdStr = serviceId ? String(serviceId) : '-';
                                      return <span className="truncate block" title={serviceIdStr}>{serviceIdStr}</span>;
                                    })()}
                                  </td>
                                  {user?.role !== 'patient' && (
                                  <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={invoice.patientName}>
                                    <div className="truncate">{invoice.patientName}</div>
                                  </td>
                                  )}
                                  <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={doctorName}>
                                    <div className="truncate">{doctorName}</div>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs truncate max-w-0">
                                    <Badge variant="outline" className="text-xs truncate max-w-full" title={serviceTypeLabel}>
                                      <span className="truncate block">{serviceTypeLabel}</span>
                                    </Badge>
                                  </td>
                                  {isAdmin && (
                                    <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={createdByName || '-'}>
                                      <div className="truncate">{createdByName || '-'}</div>
                                    </td>
                                  )}
                                  {isPatient && (
                                    <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={invoice.createdAt || invoice.created_at 
                                        ? format(new Date(invoice.createdAt || invoice.created_at), 'MMM d, yyyy HH:mm')
                                        : '-'}>
                                      <div className="truncate">
                                        {invoice.createdAt || invoice.created_at 
                                          ? format(new Date(invoice.createdAt || invoice.created_at), 'MMM d, yyyy HH:mm')
                                          : '-'}
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-0.5 py-1 text-xs truncate max-w-0">
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 truncate max-w-full text-xs">
                                      {(() => {
                                        // If status is unpaid and payment method is "Online Payment", show "Not Selected"
                                        // "Online Payment" should only show when payment is actually processed
                                        const paymentMethod = invoice.status === 'unpaid' && invoice.paymentMethod === 'Online Payment' ? 'Not Selected' : (invoice.paymentMethod || 'Not Selected');
                                        return <span className="truncate block" title={paymentMethod}>{paymentMethod}</span>;
                                      })()}
                                    </Badge>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={format(new Date(invoice.dateOfService), 'MMM d, yyyy')}>
                                    <div className="truncate">{format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</div>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs text-gray-900 dark:text-gray-100 truncate max-w-0" title={format(new Date(invoice.dueDate), 'MMM d, yyyy')}>
                                    <div className="truncate">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</div>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate max-w-0" title={formatCurrency(invoice.totalAmount)}>
                                    <div className="truncate">{formatCurrency(invoice.totalAmount)}</div>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs font-semibold text-gray-900 dark:text-gray-100 truncate max-w-0" title={formatCurrency(invoice.totalAmount - invoice.paidAmount)}>
                                    <div className="truncate">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</div>
                                  </td>
                                  <td className="px-0.5 py-1 text-xs">
                                    {isAdmin ? (
                                      <Select 
                                        value={invoice.status} 
                                        onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                        disabled={updatingStatusId === invoice.id}
                                      >
                                        <SelectTrigger className={`w-full max-w-[90px] h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                          <SelectValue>{invoice.status}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unpaid">Unpaid</SelectItem>
                                          <SelectItem value="sent">Sent</SelectItem>
                                          <SelectItem value="paid">Paid</SelectItem>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="overdue">Overdue</SelectItem>
                                          <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge className={`${getStatusColor(invoice.status)} truncate max-w-full`}>
                                        <span className="truncate block" title={invoice.status}>{invoice.status}</span>
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-0.5 py-1 text-xs">
                                    <div className="flex items-center gap-0.5">
                                      <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} title="View" className="h-5 w-5 p-0">
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      {savedInvoiceIds.has(invoice.id) && (
                                        <>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                            data-testid="button-open-saved-invoice-pdf-doctor-table" 
                                            title="Open Saved PDF"
                                            className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 h-5 w-5 p-0"
                                          >
                                            <FileText className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} title="Download" className="h-5 w-5 p-0">
                                            <Download className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice.id)} title="Send" className="h-5 w-5 p-0">
                                            <Send className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                      {canDelete('billing') && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleDeleteInvoice(invoice.id)}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-5 w-5 p-0"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    /* Grid View - Card Format */
                    <div className="space-y-4">
                      {filteredInvoices.map((invoice) => (
                        <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{invoice.patientName}</h3>
                                  {isAdmin ? (
                                    <Select 
                                      value={invoice.status} 
                                      onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                      disabled={updatingStatusId === invoice.id}
                                    >
                                      <SelectTrigger className={`w-32 h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                        <SelectValue>{invoice.status}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unpaid">Unpaid</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge className={getStatusColor(invoice.status)}>
                                      {invoice.status}
                                    </Badge>
                                  )}
                                  {invoice.status === 'overdue' && (
                                    <Badge className="bg-red-100 text-red-800">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Invoice Details</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Invoice:</strong> {invoice.invoiceNumber || invoice.id}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>Payment Method:</strong>
                                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                          {(() => {
                                            // If status is unpaid and payment method is "Online Payment", show "Not Selected"
                                            // "Online Payment" should only show when payment is actually processed
                                            if (invoice.status === 'unpaid' && invoice.paymentMethod === 'Online Payment') {
                                              return 'Not Selected';
                                            }
                                            return invoice.paymentMethod || 'Not Selected';
                                          })()}
                                        </Badge>
                                      </div>
                                      <div><strong>Service Date:</strong> {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</div>
                                      <div><strong>Due Date:</strong> {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</div>
                                      {user?.role === 'admin' && (() => {
                                        // Get doctor name from doctor_id in invoices table
                                        if (invoice.doctorId) {
                                          const doctor = allUsers.find((u: any) => u.id === invoice.doctorId);
                                          if (doctor) {
                                            const firstName = doctor.firstName || '';
                                            const lastName = doctor.lastName || '';
                                            const fullName = `${firstName} ${lastName}`.trim();
                                            return (
                                              <div>
                                                <strong>Doctor Name:</strong>{' '}
                                                <span>{fullName || '-'}</span>
                                              </div>
                                            );
                                          }
                                        }
                                        return (
                                          <div>
                                            <strong>Doctor Name:</strong>{' '}
                                            <span className="text-gray-400">-</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Amount</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Total:</strong> {formatCurrency(invoice.totalAmount)}</div>
                                      <div><strong>Paid:</strong> {formatCurrency(invoice.paidAmount)}</div>
                                      <div><strong>Outstanding:</strong> {formatCurrency(invoice.totalAmount - invoice.paidAmount)}</div>
                                    </div>
                                  </div>
                                  
                                  {invoice.insurance && (
                                    <div>
                                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Insurance</h4>
                                      <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                        <div><strong>Provider:</strong> {invoice.insurance.provider}</div>
                                        <div><strong>Claim:</strong> {invoice.insurance.claimNumber}</div>
                                        <div className="flex items-center gap-2">
                                          <strong>Status:</strong>
                                          <Badge className={getInsuranceStatusColor(invoice.insurance.status)}>
                                            {invoice.insurance.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Services</h4>
                                  <div className="space-y-1">
                                    {invoice.items.slice(0, 2).map((item: any, index: number) => (
                                      <div key={index} className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                                        <span>{item.description}</span>
                                        <span>{formatCurrency(item.total || item.amount || item.unitPrice || 0)}</span>
                                      </div>
                                    ))}
                                    {invoice.items.length > 2 && (
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        +{invoice.items.length - 2} more items
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {savedInvoiceIds.has(invoice.id) && (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleOpenSavedInvoicePdf(invoice)} 
                                      data-testid="button-open-saved-invoice-pdf-doctor" 
                                      title="Open Saved PDF"
                                      className="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleSendInvoice(invoice.id)}>
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {canDelete('billing') && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

            {filteredInvoices.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                <p className="text-gray-600 dark:text-gray-300">Try adjusting your search terms or filters</p>
              </div>
            )}
              </TabsContent>

              <TabsContent value="outstanding" className="space-y-4 mt-6">
                {/* Outstanding Invoices Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Outstanding Invoices</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      All invoices with status except paid
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {Array.isArray(invoices) && invoices.filter(invoice => {
                            // Filter for patients - only show their own invoices
                            if (isPatient && currentPatientId && invoice.patientId !== currentPatientId) {
                              return false;
                            }
                            return invoice.status !== 'paid';
                          }).map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`outstanding-invoice-row-${invoice.id}`}>
                              <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{invoice.id}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{invoice.patientName}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount)}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
                              <td className="px-4 py-4 text-sm">
                                <Badge className={`${getStatusColor(invoice.status)}`}>
                                  {invoice.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewInvoice(invoice)}
                                    data-testid={`button-view-outstanding-${invoice.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadPDF(invoice)}
                                    data-testid={`button-download-outstanding-${invoice.id}`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {Array.isArray(invoices) && invoices.filter(invoice => invoice.status !== 'paid').length === 0 && (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No outstanding invoices</h3>
                        <p className="text-gray-600 dark:text-gray-300">All invoices have been paid</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payment-history" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      A summary of all payments made — whether from patients or insurance — across all invoices
                    </p>
                  </CardHeader>
                  <CardContent>
                    {paymentsLoading ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Loading payments...</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-800">
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Payer</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Method</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(payments) && payments.length > 0 ? (
                              payments
                                .filter((payment: any) => {
                                  // Filter for patients - only show payments for their own invoices
                                  if (isPatient && currentPatientId) {
                                    return payment.invoice?.patientId === currentPatientId;
                                  }
                                  return true;
                                })
                                .map((payment: any) => {
                                // Get patient name from joined invoice data or metadata
                                let patientName = payment.invoice?.patientName || payment.metadata?.patientName;
                                
                                if (!patientName) {
                                  const patient = patients?.find((p: any) => p.patientId === payment.patientId);
                                  patientName = patient ? `${patient.firstName} ${patient.lastName}` : payment.patientId;
                                }
                                
                                // Use joined invoice data
                                const invoice = payment.invoice;
                                const invoiceNumber = invoice?.invoiceNumber || payment.invoiceId;
                                
                                return (
                                  <tr key={payment.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                      {invoiceNumber}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                      {patientName}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                      {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                                      {payment.paymentMethod === 'cash' ? 'Cash' : payment.paymentMethod === 'debit_card' ? 'Debit Card' : payment.paymentMethod.replace('_', ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                      £{(typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      <span className={`inline-flex items-center gap-1 ${
                                        payment.paymentStatus === 'completed' ? 'text-green-700 dark:text-green-400' : 
                                        payment.paymentStatus === 'pending' ? 'text-yellow-700 dark:text-yellow-400' : 
                                        'text-red-700 dark:text-red-400'
                                      }`}>
                                        <span className={payment.paymentStatus === 'completed' ? 'text-green-600' : payment.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'}>
                                          {payment.paymentStatus === 'completed' ? '✓' : payment.paymentStatus === 'pending' ? '⏱' : '✗'}
                                        </span> 
                                        {payment.paymentStatus === 'completed' ? 'Successful' : payment.paymentStatus === 'pending' ? 'Pending' : 'Failed'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {invoice ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleViewInvoice(invoice)} 
                                            data-testid="button-view-invoice-from-payment"
                                            title="View Invoice"
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => {
                                              handleViewInvoice(invoice);
                                              setTimeout(() => {
                                                const printBtn = document.querySelector('[data-testid="button-download-invoice"]') as HTMLButtonElement;
                                                if (printBtn) printBtn.click();
                                              }, 500);
                                            }}
                                            data-testid="button-download-invoice-from-payment"
                                            title="Download Invoice"
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">N/A</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                  <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                  <p className="text-sm">No payment history available</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Self-Pay Invoices (None or Patient Self-Pay)
                    </p>
                  </CardHeader>
                  <CardContent>
                    {invoicesLoading ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Loading invoices...</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-800">
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice #</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Patient</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Service Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Total Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const selfPayInvoices = Array.isArray(invoices) ? invoices.filter((inv: any) => {
                                // Filter for patients - only show their own invoices
                                if (isPatient && currentPatientId && inv.patientId !== currentPatientId) {
                                  return false;
                                }
                                
                                if (!inv.insurance || inv.insurance === null || inv.insurance === '' || inv.insurance === 'none') {
                                  return true;
                                }
                                
                                const provider = typeof inv.insurance === 'object' ? inv.insurance.provider : inv.insurance;
                                const providerLower = String(provider).toLowerCase();
                                
                                return providerLower === 'none' || providerLower === 'self-pay';
                              }) : [];
                              
                              return selfPayInvoices.length > 0 ? (
                                selfPayInvoices.map((invoice: any) => {
                                  const totalAmount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
                                  
                                  return (
                                    <tr key={invoice.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {invoice.invoiceNumber || invoice.id}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.patientName || invoice.patientId}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                        {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                        {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                        £{totalAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                                        {(() => {
                                          // If status is unpaid and payment method is "Online Payment", show "Not Selected"
                                          // "Online Payment" should only show when payment is actually processed
                                          if (invoice.status === 'unpaid' && invoice.paymentMethod === 'Online Payment') {
                                            return 'Not Selected';
                                          }
                                          return invoice.paymentMethod || 'Not Selected';
                                        })()}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <Badge className={`${getStatusColor(invoice.status)}`}>
                                          {invoice.status}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleViewInvoice(invoice)} 
                                          data-testid={`button-view-invoice-${invoice.id}`}
                                          title="View Invoice"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-sm">No self-pay invoices available</p>
                                  </td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insurance-claims" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🛡️ Insurance Claims Management
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Submit claims, track payments, and manage insurance-related invoices
                    </p>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const insuranceClaims = Array.isArray(invoices) ? invoices.filter((inv: any) => {
                        if (isPatient && currentPatientId && inv.patientId !== currentPatientId) {
                          return false;
                        }
                        return inv.invoiceType === 'insurance_claim' || inv.insurance;
                      }) : [];

                      const totalBilled = insuranceClaims.reduce((sum, inv: any) => 
                        sum + (typeof inv.totalAmount === 'string' ? parseFloat(inv.totalAmount) : inv.totalAmount || 0), 0);
                      const totalPaid = insuranceClaims.reduce((sum, inv: any) => 
                        sum + (inv.insurance?.paidAmount || 0), 0);
                      const totalPending = totalBilled - totalPaid;

                      return (
                        <>
                          {/* Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Billed</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">£{totalBilled.toFixed(2)}</p>
                                  </div>
                                  <Calendar className="h-8 w-8 text-blue-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">£{totalPaid.toFixed(2)}</p>
                                  </div>
                                  <CheckCircle className="h-8 w-8 text-green-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Pending</p>
                                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">£{totalPending.toFixed(2)}</p>
                                  </div>
                                  <Clock className="h-8 w-8 text-orange-500" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Insurance Claims Table */}
                          <div className="rounded-md border">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Patient</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Provider</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Claim #</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Billed</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Paid</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Balance</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {insuranceClaims.length > 0 ? insuranceClaims.map((invoice: any) => {
                                  const totalAmount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount || 0;
                                  const paidAmount = invoice.insurance?.paidAmount || 0;
                                  const balance = totalAmount - paidAmount;

                                  return (
                                    <tr key={invoice.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {invoice.invoiceNumber || invoice.id}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.patientName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.insurance?.provider || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                        {invoice.insurance?.claimNumber || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                        £{totalAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 text-right font-medium">
                                        £{paidAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400 text-right font-medium">
                                        £{balance.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        {invoice.insurance?.status === 'approved' ? (
                                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                            ✅ Approved
                                          </Badge>
                                        ) : invoice.insurance?.status === 'denied' ? (
                                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                            ❌ Denied
                                          </Badge>
                                        ) : invoice.insurance?.status === 'partially_paid' ? (
                                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                            ⚠️ Partial
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                            ⏱ Pending
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <div className="flex gap-2">
                                          {!invoice.insurance && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleSubmitClaim(invoice)}
                                              data-testid={`button-submit-claim-${invoice.id}`}
                                            >
                                              Submit Claim
                                            </Button>
                                          )}
                                          {invoice.insurance && balance > 0 && (
                                            <Button
                                              size="sm"
                                              onClick={() => handleRecordPayment(invoice)}
                                              data-testid={`button-record-payment-${invoice.id}`}
                                            >
                                              Record Payment
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleViewInvoice(invoice)}
                                            data-testid={`button-view-${invoice.id}`}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }) : (
                                  <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                      <p className="text-sm font-medium">No insurance claims found</p>
                                      <p className="text-xs mt-1">Insurance claims will appear here when invoices are billed to insurance providers</p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom Reports Tab */}
              {isAdmin && (
                <TabsContent value="custom-reports" className="space-y-4 mt-6">
                  {/* Report Filters */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Report Filters
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <Label>Date Range</Label>
                          <Select value={reportDateRange} onValueChange={setReportDateRange}>
                            <SelectTrigger data-testid="select-report-date-range">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="this-week">This Week</SelectItem>
                              <SelectItem value="this-month">This Month</SelectItem>
                              <SelectItem value="last-month">Last Month</SelectItem>
                              <SelectItem value="this-quarter">This Quarter</SelectItem>
                              <SelectItem value="this-year">This Year</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Insurance Type</Label>
                          <Popover open={insuranceSearchOpen} onOpenChange={setInsuranceSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={insuranceSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-insurance-type"
                              >
                                {reportInsuranceType === "all" ? "All Insurance" : reportInsuranceType}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search insurance..." />
                                <CommandEmpty>No insurance provider found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportInsuranceType("all");
                                      setInsuranceSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportInsuranceType === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Insurance
                                  </CommandItem>
                                  {["NHS (National Health Service)", "Bupa", "AXA PPP Healthcare", "Vitality Health", "Aviva Health", "Simply Health", "WPA", "Benenden Health", "Healix Health Services", "Sovereign Health Care", "Exeter Friendly Society", "Self-Pay", "Other"].map((provider) => (
                                    <CommandItem
                                      key={provider}
                                      value={provider}
                                      onSelect={() => {
                                        setReportInsuranceType(provider);
                                        setInsuranceSearchOpen(false);
                                      }}
                                    >
                                      <Check className={reportInsuranceType === provider ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                      {provider}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Select Role</Label>
                          <Popover open={roleSearchOpen} onOpenChange={setRoleSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={roleSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-role"
                              >
                                {reportRole === "all" ? "All Roles" : reportRole}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search role..." />
                                <CommandEmpty>No role found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportRole("all");
                                      setReportUserName("all");
                                      setRoleSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportRole === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Roles
                                  </CommandItem>
                                  {roles.map((role: any) => (
                                    <CommandItem
                                      key={role.id}
                                      value={role.name}
                                      onSelect={() => {
                                        setReportRole(role.name);
                                        setReportUserName("all");
                                        setRoleSearchOpen(false);
                                      }}
                                    >
                                      <Check className={reportRole === role.name ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                      {role.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Select Name</Label>
                          <Popover open={nameSearchOpen} onOpenChange={setNameSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={nameSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-user-name"
                              >
                                {reportUserName === "all" ? "All Names" : users.find((u: any) => String(u.id) === reportUserName)?.firstName + " " + users.find((u: any) => String(u.id) === reportUserName)?.lastName || "Select name"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search name..." />
                                <CommandEmpty>No user found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportUserName("all");
                                      setNameSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportUserName === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Names
                                  </CommandItem>
                                  {users
                                    .filter((user: any) => reportRole === "all" || user.role === reportRole)
                                    .map((user: any) => (
                                      <CommandItem
                                        key={user.id}
                                        value={`${user.firstName} ${user.lastName}`}
                                        onSelect={() => {
                                          setReportUserName(String(user.id));
                                          setNameSearchOpen(false);
                                        }}
                                      >
                                        <Check className={reportUserName === String(user.id) ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                        {user.firstName} {user.lastName}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            className="w-full" 
                            onClick={async () => {
                              try {
                                const params = new URLSearchParams({
                                  dateRange: reportDateRange,
                                  insuranceType: reportInsuranceType,
                                  role: reportRole,
                                  userName: reportUserName
                                });
                                
                                const response = await fetch(`/api/reports/revenue-breakdown?${params}`, {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                                    'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'cura'
                                  }
                                });
                                
                                if (response.ok) {
                                  const data = await response.json();
                                  setDisplayedReportData(data);
                                  setReportGenerated(true);
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to generate report",
                                    variant: "destructive"
                                  });
                                }
                              } catch (error) {
                                console.error("Report generation error:", error);
                                toast({
                                  title: "Error",
                                  description: "Failed to generate report",
                                  variant: "destructive"
                                });
                              }
                            }}
                            data-testid="button-generate-report"
                          >
                            <FileBarChart className="h-4 w-4 mr-2" />
                            Generate Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Generated Report Display */}
                  {reportGenerated && displayedReportData && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <FileBarChart className="h-5 w-5" />
                            Generated Report
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={exportRevenueCSV}
                              data-testid="button-download-csv"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download CSV
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={exportRevenuePDF}
                              data-testid="button-download-pdf"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setReportGenerated(false);
                                setDisplayedReportData(null);
                              }}
                              data-testid="button-close-report"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Report Header */}
                        <div className="border-b pb-4">
                          <h3 className="text-lg font-semibold mb-2">Custom Revenue Report</h3>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <p><strong>Period:</strong> {format(displayedReportData.dateRange.start, 'MMM d, yyyy')} - {format(displayedReportData.dateRange.end, 'MMM d, yyyy')}</p>
                            <p><strong>Generated:</strong> {format(new Date(), 'MMM d, yyyy HH:mm')}</p>
                          </div>
                        </div>

                        {/* Patient Information (if specific patient selected) */}
                        {displayedReportData.patientInfo && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                              <User className="h-5 w-5" />
                              Patient Information
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><strong>Name:</strong> {displayedReportData.patientInfo.name}</div>
                              <div><strong>Patient ID:</strong> {displayedReportData.patientInfo.patientId}</div>
                              <div><strong>Insurance Provider:</strong> {displayedReportData.patientInfo.insurance}</div>
                              <div><strong>Insurance Number:</strong> {displayedReportData.patientInfo.insuranceNumber}</div>
                              <div><strong>Phone:</strong> {displayedReportData.patientInfo.phone}</div>
                              <div><strong>Email:</strong> {displayedReportData.patientInfo.email}</div>
                            </div>
                          </div>
                        )}

                        {/* Applied Filters */}
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Applied Filters</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Date Range:</strong> {reportDateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                            {displayedReportData.filters.insuranceType !== 'all' && (
                              <p><strong>Insurance Type:</strong> {displayedReportData.filters.insuranceType}</p>
                            )}
                            {displayedReportData.filters.role !== 'all' && (
                              <p><strong>Role:</strong> {displayedReportData.filters.role}</p>
                            )}
                            {displayedReportData.filters.userName !== 'all' && !displayedReportData.patientInfo && (
                              <p><strong>User:</strong> {users.find((u: any) => String(u.id) === displayedReportData.filters.userName)?.firstName} {users.find((u: any) => String(u.id) === displayedReportData.filters.userName)?.lastName}</p>
                            )}
                          </div>
                        </div>

                        {/* Revenue Breakdown Table */}
                        <div>
                          <h4 className="font-semibold text-lg mb-3">Revenue Breakdown by Service Type</h4>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                  <th className="text-left p-3">Service Type</th>
                                  <th className="text-left p-3">Procedures</th>
                                  <th className="text-left p-3">Revenue</th>
                                  <th className="text-left p-3">Insurance</th>
                                  <th className="text-left p-3">Self-Pay</th>
                                  <th className="text-left p-3">Collection Rate</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedReportData.breakdown && displayedReportData.breakdown.length > 0 ? (
                                  displayedReportData.breakdown.map((item: any, index: number) => (
                                    <tr 
                                      key={index} 
                                      className={`border-b ${item.serviceName === 'Total' ? 'bg-gray-50 dark:bg-gray-800 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    >
                                      <td className="p-3 font-medium">{item.serviceName}</td>
                                      <td className="p-3">{item.procedures}</td>
                                      <td className="p-3 font-semibold">{formatCurrency(item.revenue)}</td>
                                      <td className="p-3">{formatCurrency(item.insurance)}</td>
                                      <td className="p-3">{formatCurrency(item.selfPay)}</td>
                                      <td className="p-3">
                                        <Badge className={`${
                                          item.collectionRate >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                          item.collectionRate >= 75 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                        }`}>
                                          {item.collectionRate}%
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                      No data available for the selected filters
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* Pricing Management Tab */}
              {isAdmin && (
                <TabsContent value="pricing-management" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PoundSterling className="h-5 w-5" />
                        Pricing Management
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage pricing for doctors, lab tests, and imaging services with version history tracking
                      </p>
                    </CardHeader>
                    <CardContent>
                      <PricingManagementDashboard />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
            )}

          {false && isAdmin && (
            <div className="space-y-6">
              {/* Report Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('revenue')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Revenue Report</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Monthly and yearly revenue analysis</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {format(new Date(), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('outstanding')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Outstanding Invoices</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Unpaid and overdue invoices</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Total: {formatCurrency(getOutstandingAmount())}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('insurance')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Insurance Analytics</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Claims processing and reimbursements</p>
                    </div>
                    <PieChart className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Active claims: 12
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('aging')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Aging Report</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Accounts receivable by age</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    30+ days: £1,250
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('provider')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Provider Performance</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Revenue by healthcare provider</p>
                    </div>
                    <User className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    5 providers tracked
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('procedures')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Procedure Analysis</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Most profitable procedures and services</p>
                    </div>
                    <Target className="h-8 w-8 text-teal-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Top CPT: 99213
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Quick Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(getTotalRevenue())}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Revenue</div>
                    <div className="text-xs text-green-600 mt-1">+12% vs last month</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(getOutstandingAmount())}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Outstanding</div>
                    <div className="text-xs text-red-600 mt-1">2 overdue invoices</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">92%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Collection Rate</div>
                    <div className="text-xs text-green-600 mt-1">Above industry avg</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">18 days</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Avg Collection Time</div>
                    <div className="text-xs text-orange-600 mt-1">Industry: 25 days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
            )}
        </div>
      </div>

      {/* New Invoice Dialog */}
      <Dialog open={showNewInvoice} onOpenChange={setShowNewInvoice}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1 pr-2 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patient">Patient</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder={patientsLoading ? "Loading patients..." : "Select patient"} />
                  </SelectTrigger>
                  <SelectContent 
                    className="max-h-[180px] overflow-y-auto"
                    position="popper"
                    sideOffset={4}
                    align="start"
                  >
                    {patientsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : patients && patients.length > 0 ? (
                      (() => {
                        // Deduplicate patients by unique name combination
                        const uniquePatients = patients.filter((patient: any, index: number, array: any[]) => 
                          array.findIndex((p: any) => 
                            `${p.firstName} ${p.lastName}` === `${patient.firstName} ${patient.lastName}`
                          ) === index
                        );
                        return uniquePatients.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.patientId}>
                            {patient.patientId} - {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ));
                      })()
                    ) : (
                      <SelectItem value="no-patients" disabled>No patients found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {patientError && (
                  <p className="text-sm text-red-600 mt-1">{patientError}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="service-date">Service Date</Label>
                <Input 
                  id="service-date" 
                  type="date" 
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Doctor Name Field */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doctor-name">
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Doctor'}
                </Label>
                {isDoctor ? (
                  <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.lastName || '-'}
                  </div>
                ) : (
                  <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.lastName || '-'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice-date">Invoice Date</Label>
                <Input 
                  id="invoice-date" 
                  type="date" 
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="due-date">Due Date</Label>
                <Input 
                  id="due-date" 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Services & Procedures</Label>
              <div className="border rounded-md p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Service Type</Label>
                    <Select value={selectedServiceType} onValueChange={(value) => setSelectedServiceType(value as ServiceType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent 
                        className="max-h-[180px] overflow-y-auto"
                        position="popper"
                        sideOffset={4}
                        align="start"
                      >
                        {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        // Auto-select "other" service type when Add Service is clicked
                        if (selectedServiceType !== "other") {
                          setSelectedServiceType("other");
                          setServiceSelectionError("");
                        } else {
                          // If already on "other", try to add the service
                          handleAddService();
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Service
                    </Button>
                  </div>
                </div>

                {selectedServiceType === "appointments" && (
                  <div className="space-y-2">
                    <Label>Appointment</Label>
                    <Select value={selectedAppointmentId} onValueChange={setSelectedAppointmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder={patientAppointmentsLoading ? "Loading appointments..." : "Select appointment"} />
                      </SelectTrigger>
                      <SelectContent 
                        className="max-h-[180px] overflow-y-auto overflow-x-hidden"
                        position="popper"
                        sideOffset={4}
                        align="start"
                        style={{ width: 'var(--radix-select-trigger-width)', maxWidth: 'var(--radix-select-trigger-width)' }}
                      >
                        {patientAppointmentsLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : availableAppointments.length > 0 ? (
                          availableAppointments.map((appointment: any) => {
                            // Format datetime for display
                            let datetimeStr = '';
                            if (appointment.scheduledAt) {
                              try {
                                const scheduledDate = new Date(appointment.scheduledAt);
                                const dateStr = scheduledDate.toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                });
                                const timeStr = scheduledDate.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                });
                                datetimeStr = ` - ${dateStr} ${timeStr}`;
                              } catch (e) {
                                // Fallback if date parsing fails
                                datetimeStr = '';
                              }
                            }
                            const appointmentText = `${appointment.appointmentId || `APT-${appointment.id}`} - ${appointment.title || "Consultation"}${datetimeStr}`;
                            return (
                              <SelectItem 
                                key={appointment.id} 
                                value={String(appointment.id)}
                                className="[&>*]:truncate [&>*]:block [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap max-w-full"
                                title={appointmentText}
                              >
                                {appointmentText}
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="none" disabled>No appointments found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    
                    {/* Appointment Details Card */}
                    {selectedAppointmentId && (() => {
                      const selectedAppointment = availableAppointments.find((apt: any) => String(apt.id) === selectedAppointmentId);
                      if (!selectedAppointment) return null;

                      // Extract dates directly to avoid timezone conversion
                      let appointmentDateStr = '';
                      let dueDateStr = '';
                      let createdAtStr = '';
                      
                      if (selectedAppointment.scheduledAt) {
                        const scheduledAtStr = selectedAppointment.scheduledAt.toString();
                        if (scheduledAtStr.includes('T')) {
                          appointmentDateStr = scheduledAtStr.split('T')[0];
                          dueDateStr = scheduledAtStr.split('T')[0];
                        } else {
                          const dateObj = new Date(selectedAppointment.scheduledAt);
                          const year = dateObj.getFullYear();
                          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                          const day = String(dateObj.getDate()).padStart(2, '0');
                          appointmentDateStr = `${year}-${month}-${day}`;
                          dueDateStr = `${year}-${month}-${day}`;
                        }
                      }

                      if (selectedAppointment.createdAt) {
                        const createdAtStrValue = selectedAppointment.createdAt.toString();
                        if (createdAtStrValue.includes('T')) {
                          createdAtStr = createdAtStrValue.split('T')[0];
                        } else {
                          const dateObj = new Date(selectedAppointment.createdAt);
                          const year = dateObj.getFullYear();
                          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                          const day = String(dateObj.getDate()).padStart(2, '0');
                          createdAtStr = `${year}-${month}-${day}`;
                        }
                      }

                      const appointmentDate = appointmentDateStr ? format(new Date(appointmentDateStr + 'T00:00:00'), "dd MMM yyyy") : 'N/A';
                      const appointmentTime = selectedAppointment.scheduledAt ? format(new Date(selectedAppointment.scheduledAt), "h:mm a") : 'N/A';
                      const dueDate = dueDateStr ? format(new Date(dueDateStr + 'T00:00:00'), "dd MMM yyyy") : 'N/A';
                      const createdDate = createdAtStr ? format(new Date(createdAtStr + 'T00:00:00'), "dd MMM yyyy") : 'N/A';
                      const provider = allUsers.find((u: any) => u.id === selectedAppointment.providerId);

                      return (
                        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-900/10 mt-2">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold">Appointment Details</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Appointment ID:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedAppointment.appointmentId || `APT-${selectedAppointment.id}`}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Title:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedAppointment.title || "Consultation"}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Date:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{appointmentDate}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Time:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{appointmentTime}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Due Date:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{dueDate}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Created Date:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{createdDate}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Duration:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedAppointment.duration || 30} minutes</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100 capitalize">{selectedAppointment.status || 'N/A'}</span>
                              </div>
                              {provider && (
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Provider:</span>
                                  <span className="ml-2 text-gray-900 dark:text-gray-100">{provider.firstName} {provider.lastName}</span>
                                </div>
                              )}
                              {selectedAppointment.location && (
                                <div>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Location:</span>
                                  <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedAppointment.location}</span>
                                </div>
                              )}
                              {selectedAppointment.description && (
                                <div className="col-span-2">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                                  <span className="ml-2 text-gray-900 dark:text-gray-100">{selectedAppointment.description}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                )}

                {selectedServiceType === "labResults" && (
                  <div className="space-y-2">
                    <Label>Lab Result</Label>
                    <Select value={selectedLabResultId} onValueChange={setSelectedLabResultId}>
                      <SelectTrigger>
                        <SelectValue placeholder={patientLabResultsLoading ? "Loading lab results..." : "Select lab result"} />
                      </SelectTrigger>
                      <SelectContent 
                        className="max-h-[180px] overflow-y-auto overflow-x-hidden"
                        position="popper"
                        sideOffset={4}
                        align="start"
                        style={{ width: 'var(--radix-select-trigger-width)', maxWidth: 'var(--radix-select-trigger-width)' }}
                      >
                        {patientLabResultsLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : availableLabResults.length > 0 ? (
                          availableLabResults.map((result: any) => {
                            // Extract date directly from orderedDate or createdAt to avoid timezone conversion
                            let dueDateStr = '';
                            if (result.orderedDate) {
                              const orderedDateStr = result.orderedDate.toString();
                              if (orderedDateStr.includes('T')) {
                                dueDateStr = orderedDateStr.split('T')[0];
                              } else {
                                const dateObj = new Date(result.orderedDate);
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                dueDateStr = `${year}-${month}-${day}`;
                              }
                            } else if (result.createdAt) {
                              const createdAtStr = result.createdAt.toString();
                              if (createdAtStr.includes('T')) {
                                dueDateStr = createdAtStr.split('T')[0];
                              } else {
                                const dateObj = new Date(result.createdAt);
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                dueDateStr = `${year}-${month}-${day}`;
                              }
                            }
                            const dueDate = dueDateStr ? format(new Date(dueDateStr + 'T00:00:00'), "dd MMM yyyy") : '';
                            const fullText = `${result.testId || `LR-${result.id}`} - ${result.testName} (${result.status}${dueDate ? `, Due: ${dueDate}` : ''})`;
                            return (
                              <SelectItem 
                                key={result.id} 
                                value={String(result.id)}
                                className="[&>*]:truncate [&>*]:block [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap max-w-full"
                                title={fullText}
                              >
                                {fullText}
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="none" disabled>No lab results found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedServiceType === "imaging" && (
                  <div className="space-y-2">
                    <Label>Imaging Study</Label>
                    <Select value={selectedImagingId} onValueChange={setSelectedImagingId}>
                      <SelectTrigger>
                        <SelectValue placeholder={patientImagingLoading ? "Loading imaging..." : "Select imaging study"} />
                      </SelectTrigger>
                      <SelectContent 
                        className="max-h-[180px] overflow-y-auto overflow-x-hidden"
                        position="popper"
                        sideOffset={4}
                        align="start"
                        style={{ width: 'var(--radix-select-trigger-width)', maxWidth: 'var(--radix-select-trigger-width)' }}
                      >
                        {patientImagingLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : availableImaging.length > 0 ? (
                          availableImaging.map((study: any) => {
                            // Extract date directly from studyDate or createdAt to avoid timezone conversion
                            let dueDateStr = '';
                            if (study.studyDate) {
                              const studyDateStr = study.studyDate.toString();
                              if (studyDateStr.includes('T')) {
                                dueDateStr = studyDateStr.split('T')[0];
                              } else {
                                const dateObj = new Date(study.studyDate);
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                dueDateStr = `${year}-${month}-${day}`;
                              }
                            } else if (study.createdAt) {
                              const createdAtStr = study.createdAt.toString();
                              if (createdAtStr.includes('T')) {
                                dueDateStr = createdAtStr.split('T')[0];
                              } else {
                                const dateObj = new Date(study.createdAt);
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                dueDateStr = `${year}-${month}-${day}`;
                              }
                            }
                            const dueDate = dueDateStr ? format(new Date(dueDateStr + 'T00:00:00'), "dd MMM yyyy") : '';
                            const imagingText = `${study.studyType || "Imaging"} - ${study.imageId || `IMG-${study.id}`}${dueDate ? ` (Due: ${dueDate})` : ''}`;
                            return (
                              <SelectItem 
                                key={study.id} 
                                value={String(study.id)}
                                className="[&>*]:truncate [&>*]:block [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap max-w-full"
                                title={imagingText}
                              >
                                {imagingText}
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="none" disabled>No imaging records found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedServiceType === "other" && (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Service Code</Label>
                      <Input
                        value={manualServiceEntry.code}
                        onChange={(e) => setManualServiceEntry((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="CPT or custom code"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={manualServiceEntry.description}
                        onChange={(e) => setManualServiceEntry((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Service description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={manualServiceEntry.quantity}
                          onChange={(e) => setManualServiceEntry((prev) => ({ ...prev, quantity: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Unit Price (£)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={manualServiceEntry.unitPrice}
                          onChange={(e) => setManualServiceEntry((prev) => ({ ...prev, unitPrice: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  {lineItems.length > 0 ? (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">Code</th>
                            <th className="p-2 text-left">Description</th>
                            <th className="p-2 text-left">Provider</th>
                            <th className="p-2 text-center">Qty</th>
                            <th className="p-2 text-right">Unit Price</th>
                            <th className="p-2 text-right">Total</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                              <td className="p-2 font-mono">{item.code}</td>
                              <td className="p-2">{item.description}</td>
                              <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                                {item.providerName || "—"}
                              </td>
                              <td className="p-2 text-center">
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateLineItemQuantity(item.id, e.target.value)}
                                />
                              </td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.unitPrice}
                                  readOnly={item.readOnlyPrice}
                                  disabled={item.readOnlyPrice}
                                  onChange={(e) => handleUpdateLineItemUnitPrice(item.id, e.target.value)}
                                />
                              </td>
                              <td className="p-2 text-right font-semibold">£{item.total.toFixed(2)}</td>
                              <td className="p-2">
                                <Badge className="border border-dashed border-gray-300 dark:border-gray-600 text-xs">
                                  {SERVICE_TYPE_LABELS[item.serviceType]}
                                </Badge>
                              </td>
                              <td className="p-2 text-center">
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveLineItem(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Add at least one service or procedure to generate an invoice total.
                    </p>
                  )}
                </div>

                {serviceSelectionError && (
                  <p className="text-sm text-red-600">{serviceSelectionError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Payment Method</Label>
                <Select value={invoicePaymentMethod} onValueChange={(value) => handleInvoicePaymentMethodChange(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    className="max-h-[180px] overflow-y-auto"
                    position="popper"
                    sideOffset={4}
                    align="start"
                  >
                    <SelectItem value="Not Selected">Not Selected</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online Payment">Online Payment</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="total">Total Amount</Label>
                <Input 
                  id="total"
                  placeholder="Total will be calculated from line items"
                  value={totalAmount}
                  readOnly
                />
                {totalAmountError && (
                  <p className="text-sm text-red-600 mt-1">{totalAmountError}</p>
                )}
              </div>
            </div>

            {invoicePaymentMethod === "Insurance" && (
              <div className="border border-blue-200 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-800 dark:text-blue-200">Insurance Details</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openInsuranceDialog()}
                  >
                    {insuranceDetails.provider ? "Update" : "Add Insurance Info"}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {insuranceDetails.provider
                      ? `Provider: ${insuranceDetails.provider}`
                      : "No insurance provider recorded yet."}
                  </p>
                  {insuranceDetails.planType && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Plan Type: {insuranceDetails.planType}
                    </p>
                  )}
                  {insuranceDetails.policyNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Policy #: {insuranceDetails.policyNumber}
                    </p>
                  )}
                  {insuranceDetails.memberNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Member #: {insuranceDetails.memberNumber}
                    </p>
                  )}
                  {insuranceDetails.memberName && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Member: {insuranceDetails.memberName}
                    </p>
                  )}
                  {insuranceDetails.contact && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Contact: {insuranceDetails.contact}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Insurance Status</Label>
                  <Select
                    value={invoiceStatus}
                    onValueChange={(value) => setInvoiceStatus(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent 
                      className="max-h-[180px] overflow-y-auto"
                      position="popper"
                      sideOffset={4}
                      align="start"
                    >
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="font-semibold">Invoice Type:</Label>
                <Badge 
                  className={
                    insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" 
                      : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  }
                >
                  {insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                    ? "Insurance Claim" 
                    : "Payment (Self-Pay)"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                  ? "This invoice will be billed to the insurance provider" 
                  : "This invoice will be paid directly by the patient"}
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Additional notes or instructions..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setShowNewInvoice(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isCreatingInvoice ? "Processing..." : "Review & Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedInvoice?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Patient Information</h3>
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><strong>Name:</strong> {selectedInvoice.patientName}</div>
                    <div><strong>Patient ID:</strong> {selectedInvoice.patientId}</div>
                    <div><strong>Service Date:</strong> {format(new Date(selectedInvoice.dateOfService), 'MMM d, yyyy')}</div>
                    <div><strong>Invoice Date:</strong> {format(new Date(selectedInvoice.invoiceDate), 'MMM d, yyyy')}</div>
                    <div><strong>Due Date:</strong> {format(new Date(selectedInvoice.dueDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Billing Summary</h3>
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><strong>Invoice ID:</strong> {selectedInvoice.invoiceNumber || selectedInvoice.id}</div>
                    <div className="flex items-center gap-2">
                      <strong>Status:</strong> 
                      {isEditingStatus ? (
                        <div className="flex items-center gap-2">
                          <Select value={editedStatus} onValueChange={setEditedStatus}>
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="draft">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={handleUpdateStatus}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingStatus(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Badge className={`${selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 
                          selectedInvoice.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                          selectedInvoice.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                          {selectedInvoice.status}
                        </Badge>
                      )}
                    </div>
                    <div><strong>Total Amount:</strong> £{parseFloat(selectedInvoice.totalAmount.toString()).toFixed(2)}</div>
                    <div><strong>Paid Amount:</strong> £{parseFloat(selectedInvoice.paidAmount.toString()).toFixed(2)}</div>
                    <div><strong>Outstanding:</strong> £{(parseFloat(selectedInvoice.totalAmount.toString()) - parseFloat(selectedInvoice.paidAmount.toString())).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Services & Procedures */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Services & Procedures</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-3 text-gray-900 dark:text-gray-100">Code</th>
                        <th className="text-left p-3 text-gray-900 dark:text-gray-100">Description</th>
                        <th className="text-right p-3 text-gray-900 dark:text-gray-100">Unit Price</th>
                        <th className="text-right p-3 text-gray-900 dark:text-gray-100">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                          <td className="p-3 font-mono text-gray-900 dark:text-gray-100">{item.code}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{item.description}</td>
                          <td className="p-3 text-right text-gray-900 dark:text-gray-100">£{Number(item.unitPrice || item.total || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-gray-900 dark:text-gray-100">£{Number(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insurance Information */}
              {selectedInvoice.insurance && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Insurance Information</h3>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-900 dark:text-gray-100">
                      <div>
                        <div><strong>Provider:</strong> {selectedInvoice.insurance.provider}</div>
                        <div><strong>Claim Number:</strong> {selectedInvoice.insurance.claimNumber}</div>
                      </div>
                      <div>
                        <div><strong>Status:</strong> 
                          <Badge className={`ml-2 ${selectedInvoice.insurance.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 
                            selectedInvoice.insurance.status === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'}`}>
                            {selectedInvoice.insurance.status}
                          </Badge>
                        </div>
                        <div><strong>Insurance Paid:</strong> £{(typeof selectedInvoice.insurance.paidAmount === 'string' ? parseFloat(selectedInvoice.insurance.paidAmount) : selectedInvoice.insurance.paidAmount).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Payment History</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {(typeof selectedInvoice.paidAmount === 'string' ? parseFloat(selectedInvoice.paidAmount) : selectedInvoice.paidAmount) > 0 ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-gray-900 dark:text-gray-100">
                      Payment of £{(typeof selectedInvoice.paidAmount === 'string' ? parseFloat(selectedInvoice.paidAmount) : selectedInvoice.paidAmount).toFixed(2)} received on {format(new Date(selectedInvoice.invoiceDate), 'MMM d, yyyy')}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-gray-100">
                      No payments received yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
            <Button variant="default" onClick={() => {
              if (selectedInvoice) {
                handleSaveInvoice(selectedInvoice.id.toString());
              }
            }} data-testid="button-save-invoice">
              <Download className="h-4 w-4 mr-2" />
              Save Invoice
            </Button>
            {isInvoiceSaved && (
              <>
                <Button onClick={() => {
                  if (selectedInvoice) {
                    handleDownloadInvoice(selectedInvoice.id.toString());
                  }
                }} data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={() => {
                  if (selectedInvoice) {
                    handleSendInvoice(selectedInvoice.id);
                  }
                }} data-testid="button-send-invoice">
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Dialog */}
      <Dialog open={sendInvoiceDialog} onOpenChange={setSendInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          
          {invoiceToSend && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div><strong>Invoice:</strong> {invoiceToSend.id}</div>
                  <div><strong>Patient:</strong> {invoiceToSend.patientName}</div>
                  <div><strong>Amount:</strong> £{(typeof invoiceToSend.totalAmount === 'string' ? parseFloat(invoiceToSend.totalAmount) : invoiceToSend.totalAmount).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="sendMethod">Send Method</Label>
                  <Select value={sendMethod} onValueChange={setSendMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="print">Print & Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sendMethod === "email" && (
                  <div>
                    <Label htmlFor="recipientEmail">Recipient Email</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="patient@email.com"
                    />
                  </div>
                )}

                {sendMethod === "sms" && (
                  <div>
                    <Label htmlFor="recipientPhone">Recipient Phone</Label>
                    <Input
                      id="recipientPhone"
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+44 7XXX XXXXXX"
                    />
                  </div>
                )}

                {sendMethod === "print" && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="recipientName">Recipient Name</Label>
                      <Input
                        id="recipientName"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientAddress">Mailing Address</Label>
                      <Textarea
                        id="recipientAddress"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Street address, City, Postal code"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="customMessage">Message (Optional)</Label>
                  <Textarea
                    id="customMessage"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendInvoiceDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSendInvoice} 
              disabled={
                (sendMethod === "email" && !recipientEmail) ||
                (sendMethod === "sms" && !recipientPhone) ||
                (sendMethod === "print" && (!recipientName || !recipientAddress))
              }
            >
              <Send className="h-4 w-4 mr-2" />
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog 
        open={showPdfViewer} 
        onOpenChange={(open) => {
          if (!open) {
            // Clean up blob URL when closing
            if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
              URL.revokeObjectURL(pdfViewerUrl);
            }
            setPdfViewerUrl(null);
            setSelectedInvoiceForPdf(null);
          }
          setShowPdfViewer(open);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>
              Invoice PDF: {selectedInvoiceForPdf?.invoiceNumber || selectedInvoiceForPdf?.id || 'Invoice'}.pdf
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-4" style={{ minHeight: '600px', height: 'calc(90vh - 120px)' }}>
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-600">Loading PDF...</span>
              </div>
            ) : pdfViewerUrl ? (
              <iframe 
                src={pdfViewerUrl} 
                className="w-full h-full border rounded" 
                title="Invoice PDF" 
                style={{ minHeight: '600px' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500">No PDF available</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              if (pdfViewerUrl && pdfViewerUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfViewerUrl);
              }
              setShowPdfViewer(false);
              setPdfViewerUrl(null);
              setSelectedInvoiceForPdf(null);
            }}>
              Close
            </Button>
            {pdfViewerUrl && (
              <>
                <Button variant="outline" onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfViewerUrl;
                  link.download = `invoice-${selectedInvoiceForPdf?.invoiceNumber || selectedInvoiceForPdf?.id || 'invoice'}.pdf`;
                  link.click();
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => {
                  window.open(pdfViewerUrl, '_blank');
                }}>
                  Open in New Tab
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Created Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{createdInvoiceNumber}</span> has been created successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Success Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Download className="h-10 w-10 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Downloaded Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{downloadedInvoiceNumber}</span> downloaded successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowDownloadModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete invoice {invoiceToDelete?.id} for {invoiceToDelete?.patientName}?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteInvoice}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Success Modal */}
      <Dialog open={showSendSuccessModal} onOpenChange={setShowSendSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Send className="h-10 w-10 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Sent Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{sentInvoiceInfo.invoiceNumber}</span> sent to <span className="font-semibold text-foreground">{sentInvoiceInfo.recipient}</span>
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSendSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Success Modal */}
      <Dialog open={showDeleteSuccessModal} onOpenChange={setShowDeleteSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Deleted Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{deletedInvoiceNumber}</span> has been successfully deleted
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowDeleteSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Success Modal */}
      <Dialog open={showStatusUpdateModal} onOpenChange={setShowStatusUpdateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Status Updated Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice status updated successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowStatusUpdateModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      {invoiceToPay && (
        <PaymentModal
          invoice={invoiceToPay}
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setInvoiceToPay(null);
          }}
          onSuccess={async () => {
            if (invoiceToPay) {
              await handlePaymentSuccess(invoiceToPay);
            }
            setShowPaymentModal(false);
            setInvoiceToPay(null);
          }}
        />
      )}

      <Dialog open={showInsuranceInfoDialog} onOpenChange={setShowInsuranceInfoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Health Insurance Information</DialogTitle>
            <DialogDescription>Please confirm or add the patient’s insurance data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm">Insurance Provider</Label>
              <Select value={insuranceForm.provider} onValueChange={(value) => setInsuranceForm({ ...insuranceForm, provider: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select insurance provider..." />
                </SelectTrigger>
                <SelectContent>
                  {insuranceProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Plan Type</Label>
              <Select value={insuranceForm.planType} onValueChange={(value) => setInsuranceForm({ ...insuranceForm, planType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  {insurancePlanTypes.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Policy Number</Label>
                <Input
                  placeholder="Enter policy number"
                  value={insuranceForm.policyNumber}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, policyNumber: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Member Number</Label>
                <Input
                  placeholder="Enter member number"
                  value={insuranceForm.memberNumber}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, memberNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Member Name</Label>
                <Input
                  placeholder="Enter member name"
                  value={insuranceForm.memberName}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, memberName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Contact</Label>
                <Input
                  placeholder="Optional contact details"
                  value={insuranceForm.contact}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, contact: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">NHS Number</Label>
              <Input
                placeholder="Enter NHS number (optional)"
                value={nhsNumber}
                onChange={(e) => setNhsNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setShowInsuranceInfoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsuranceDialogSave}>
              Save Insurance Info
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Insurance Claim Dialog */}
      <Dialog open={showSubmitClaimDialog} onOpenChange={setShowSubmitClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Insurance Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="insurance-provider">Insurance Provider</Label>
              <Input
                id="insurance-provider"
                value={claimFormData.provider}
                onChange={(e) => setClaimFormData({ ...claimFormData, provider: e.target.value })}
                placeholder="Enter insurance provider name"
                data-testid="input-insurance-provider"
              />
            </div>
            <div>
              <Label htmlFor="claim-number">Claim Number / Reference</Label>
              <Input
                id="claim-number"
                value={claimFormData.claimNumber}
                onChange={(e) => setClaimFormData({ ...claimFormData, claimNumber: e.target.value })}
                placeholder="Enter claim number"
                data-testid="input-claim-number"
              />
            </div>
            {selectedClaimInvoice && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Invoice Details</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Invoice:</strong> {selectedClaimInvoice.invoiceNumber}</p>
                  <p><strong>Patient:</strong> {selectedClaimInvoice.patientName}</p>
                  <p><strong>Amount:</strong> £{(typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitClaimDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitInsuranceClaim} data-testid="button-submit-claim-confirm">
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Insurance Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Insurance Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedClaimInvoice && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Claim Information</h4>
                  <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p><strong>Invoice:</strong> {selectedClaimInvoice.invoiceNumber}</p>
                    <p><strong>Patient:</strong> {selectedClaimInvoice.patientName}</p>
                    <p><strong>Insurance:</strong> {selectedClaimInvoice.insurance?.provider}</p>
                    <p><strong>Claim #:</strong> {selectedClaimInvoice.insurance?.claimNumber}</p>
                    <p><strong>Total Billed:</strong> £{(typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount).toFixed(2)}</p>
                    <p><strong>Previously Paid:</strong> £{(selectedClaimInvoice.insurance?.paidAmount || 0).toFixed(2)}</p>
                    <p className="text-orange-600 dark:text-orange-400"><strong>Outstanding:</strong> £{((typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount) - (selectedClaimInvoice.insurance?.paidAmount || 0)).toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="amount-paid">Amount Paid by Insurance</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    step="0.01"
                    value={paymentFormData.amountPaid}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amountPaid: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-amount-paid"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-date">Payment Date</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentFormData.paymentDate}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    data-testid="input-payment-date"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-reference">Payment Reference (Optional)</Label>
                  <Input
                    id="payment-reference"
                    value={paymentFormData.paymentReference}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentReference: e.target.value })}
                    placeholder="EOB number, check number, etc."
                    data-testid="input-payment-reference"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-notes">Notes (Optional)</Label>
                  <Textarea
                    id="payment-notes"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    data-testid="textarea-payment-notes"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={recordInsurancePayment} data-testid="button-record-payment-confirm">
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Payment Modal Component with Stripe
function PaymentModal({ invoice, open, onClose, onSuccess }: {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Pay Invoice {invoice.invoiceNumber || invoice.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2 min-h-0">
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Patient:</span>
              <span className="font-medium">{invoice.patientName}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Amount:</span>
              <span className="font-bold text-lg">${typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount).toFixed(2) : invoice.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Due Date:</span>
              <span className="text-sm">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
            </div>
          </div>

          <StripePaymentForm invoice={invoice} onSuccess={onSuccess} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Initialize Stripe only if public key is available
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Stripe Payment Form Component
function StripePaymentForm({ invoice, onSuccess, onCancel }: {
  invoice: Invoice;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        const res = await apiRequest('POST', '/api/billing/create-payment-intent', {
          invoiceId: invoice.id
        });
        
        // Ensure response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format from server');
        }
        
        const data = await res.json();
        
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else if (data?.error) {
          setError(data.error);
          toast({
            title: "Payment Error",
            description: data.error,
            variant: "destructive"
          });
        } else {
          setError('Failed to initialize payment');
          toast({
            title: "Payment Error",
            description: "Failed to initialize payment. Please try again.",
            variant: "destructive"
          });
        }
      } catch (err: any) {
        console.error('Error creating payment intent:', err);
        
        // Extract user-friendly error message
        let errorMessage = 'Failed to initialize payment. Please try again.';
        
        if (err?.message) {
          // Check if error message is JSON string
          try {
            const parsed = JSON.parse(err.message);
            if (parsed?.error) {
              errorMessage = parsed.error;
            } else {
              errorMessage = err.message;
            }
          } catch {
            // Not JSON, use message as is
            errorMessage = err.message;
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        // Make error messages more user-friendly
        if (errorMessage.includes('stripe is not defined')) {
          errorMessage = 'Payment system is not configured. Please contact support.';
        } else if (errorMessage.includes('STRIPE_SECRET_KEY')) {
          errorMessage = 'Payment system is not configured. Please contact support.';
        } else if (errorMessage.includes('500')) {
          errorMessage = 'Server error occurred. Please try again or contact support.';
        }
        
        setError(errorMessage);
        toast({
          title: "Payment Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [invoice.id, invoice.totalAmount, toast]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bluewave mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Initializing payment...</p>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Failed to initialize payment'}</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">Close</Button>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Payment processing is not configured. Please contact support.</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">Close</Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm invoice={invoice} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

// Payment Form Component (inside Elements)
function PaymentForm({ invoice, onSuccess, onCancel }: {
  invoice: Invoice;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred during payment",
          variant: "destructive"
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Process the payment on our backend
        const res = await apiRequest('POST', '/api/billing/process-payment', {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id
        });

        // Ensure response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format from server');
        }

        const result = await res.json();
        
        if (result.success) {
          toast({
            title: "Payment Successful",
            description: "Your payment has been processed successfully!",
          });
          
          onSuccess();
        } else {
          const errorMessage = result.error || 'Payment processing failed';
          toast({
            title: "Payment Failed",
            description: errorMessage,
            variant: "destructive"
          });
          throw new Error(errorMessage);
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        title: "Payment Failed",
        description: "An error occurred while processing your payment",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <PaymentElement />
      </div>
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-black hover:bg-black/90 text-white"
        >
          {isProcessing ? 'Processing...' : `Pay $${typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount).toFixed(2) : invoice.totalAmount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
}