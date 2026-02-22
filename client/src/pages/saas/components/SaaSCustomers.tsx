import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saasApiRequest } from '@/lib/saasQueryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Search, 
  Building2, 
  Plus, 
  Edit, 
  Eye,
  Users,
  Calendar,
  CreditCard,
  Settings,
  Trash2,
  CheckCircle,
  MoreVertical
} from 'lucide-react';

const formatLocalDateTime = (date: Date) => {
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - tzOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

const DELETE_TABLE_LABELS: Record<string, string> = {
  users: "Users",
  patients: "Patients",
  appointments: "Appointments",
  labResults: "Lab Results",
  medicalImages: "Medical Images",
  prescriptions: "Prescriptions",
  notifications: "Notifications",
  subscriptions: "Subscriptions",
  invoices: "Invoices",
  payments: "Payments",
  roles: "Roles",
  staffShifts: "Staff Shifts",
  doctorDefaultShifts: "Doctor Default Shifts",
  symptomChecks: "Symptom Checks",
  organizations: "Organization",
  formResponseValues: "Form Response Values",
  formResponses: "Form Responses",
  formShareLogs: "Form Share Logs",
  formShares: "Form Shares",
  formFields: "Form Fields",
  formSections: "Form Sections",
  forms: "Forms",
  treatments: "Treatments",
  treatmentsInfo: "Treatments Info",
};

const formatDeleteTableLabel = (key: string) => {
  const label = DELETE_TABLE_LABELS[key];
  if (label) return label;
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
};

const ensureFutureOrNow = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return '';
  const now = new Date();
  if (parsed < now) {
    return formatLocalDateTime(now);
  }
  return value;
};

const DEFAULT_ROLE_PERMISSIONS = [
  { role: 'Administrator', detail: 'Full system access with all permissions. Can view, edit, create, and delete across all modules.' },
  { role: 'Doctor', detail: 'Medical doctor with full clinical access. Can view all modules with edit/create permissions for clinical workflows.' },
  { role: 'Nurse', detail: 'Nursing staff with patient care access. Can view all modules with permissions for patient care tasks.' },
  { role: 'Patient', detail: 'Patient with access to own records. Can view all modules with limited edit permissions.' },
  { role: 'Receptionist', detail: 'Front desk staff with appointment management. Can view all modules with appointment and patient management permissions.' },
  { role: 'Lab Technician', detail: 'Laboratory technician with lab results access. Can view all modules with lab-specific permissions.' },
  { role: 'Pharmacist', detail: 'Pharmacist with prescription access. Can view all modules with prescription management permissions.' },
  { role: 'Dentist', detail: 'Dental professional with clinical access. Can view all modules with dental care permissions.' },
  { role: 'Dental Nurse', detail: 'Dental nursing staff with patient care access. Can view all modules with dental care support permissions.' },
  { role: 'Phlebotomist', detail: 'Blood collection specialist. Can view all modules with sample collection permissions.' },
  { role: 'Aesthetician', detail: 'Aesthetic treatment specialist. Can view all modules with aesthetic treatment permissions.' },
  { role: 'Optician', detail: 'Eye care and vision specialist. Can view all modules with vision care permissions.' },
  { role: 'Paramedic', detail: 'Emergency medical services professional. Can view all modules with emergency care permissions.' },
  { role: 'Physiotherapist', detail: 'Physical therapy specialist. Can view all modules with physical therapy permissions.' },
  { role: 'Sample Taker', detail: 'Medical sample collection specialist. Can view all modules with sample collection permissions.' },
  { role: 'Other', detail: 'Generic role for other healthcare professionals. Can view all modules with role-specific permissions.' },
];

export default function SaaSCustomers() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [deletePreviewData, setDeletePreviewData] = useState<Record<string, number> | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState('');
  const [deleteLogs, setDeleteLogs] = useState<string[]>([]);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const [isDeleteSuccessModalOpen, setIsDeleteSuccessModalOpen] = useState(false);
  const [subdomainError, setSubdomainError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [selectedPackageDetails, setSelectedPackageDetails] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    brandName: '',
    subdomain: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    accessLevel: 'full', // full, limited
    billingPackageId: '',
    status: 'active',
    paymentStatus: 'paid',
    details: '',
    expiresAt: '',
    features: {
      maxUsers: 10,
      maxPatients: 100,
      aiEnabled: true,
      telemedicineEnabled: true,
      billingEnabled: true,
      analyticsEnabled: true,
    }
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [originalCustomerValues, setOriginalCustomerValues] = useState<any>(null);
  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');
  const [viewingCustomer, setViewingCustomer] = useState<any>(null);
  const [isViewCustomerLoading, setIsViewCustomerLoading] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsOverview, setPermissionsOverview] = useState<typeof DEFAULT_ROLE_PERMISSIONS>([]);
  const viewingFeatureConfig = viewingCustomer?.features || {};
  const viewingFeatureFlags = [
    { label: 'AI Features', value: viewingFeatureConfig.aiEnabled },
    { label: 'Telemedicine', value: viewingFeatureConfig.telemedicineEnabled },
    { label: 'Billing Module', value: viewingFeatureConfig.billingEnabled },
    { label: 'Analytics & Reports', value: viewingFeatureConfig.analyticsEnabled },
  ];
  const viewingPackageFeatures = viewingCustomer?.packageFeatures || {};
  const packageFeatureList = [
    `Max users: ${viewingCustomer?.maxUsers ?? viewingPackageFeatures.maxUsers ?? 'N/A'}`,
    `Max patients: ${viewingCustomer?.maxPatients ?? viewingPackageFeatures.maxPatients ?? 'N/A'}`,
    viewingPackageFeatures.aiEnabled ? 'AI Features' : null,
    viewingPackageFeatures.telemedicineEnabled ? 'Telemedicine' : null,
    viewingPackageFeatures.billingEnabled ? 'Billing' : null,
    viewingPackageFeatures.analyticsEnabled ? 'Analytics' : null,
    viewingPackageFeatures.customBranding ? 'Custom Branding' : null,
    viewingPackageFeatures.prioritySupport ? 'Priority Support' : null,
    viewingPackageFeatures.storageGB ? `Storage: ${viewingPackageFeatures.storageGB} GB` : null,
    viewingPackageFeatures.apiCallsPerMonth
      ? `API calls/month: ${viewingPackageFeatures.apiCallsPerMonth}`
      : null,
  ].filter(Boolean) as string[];
  const minExpiresAt = formatLocalDateTime(new Date());
  const formatCurrency = (amount: number, currency: string = 'GBP') =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount);
  const formatDaysActive = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return '—';
    }
    return `${value} day${value === 1 ? '' : 's'}`;
  };
  const handlePermissionsConfirmed = () => {
    setShowPermissionsModal(false);
    setIsSuccessModalOpen(true);
  };
  const isPopupOpen =
    isAddDialogOpen ||
    isSuccessModalOpen ||
    isErrorModalOpen ||
    showUpdateSuccessModal ||
    isDeleteDialogOpen ||
    isDeleteSuccessModalOpen ||
    Boolean(editingCustomer);

  // Fetch all organizations/customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/saas/customers', searchTerm, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      
      const response = await saasApiRequest('GET', `/api/saas/customers?${params.toString()}`);
      return response.json();
    },
  });

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    setSearchTerm(trimmed);
    setSearchInput(trimmed);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (!searchInput.trim()) {
        setSearchTerm('');
        return;
      }
      setSearchTerm(searchInput.trim());
    }, 350);

    return () => clearTimeout(debounce);
  }, [searchInput]);

  // Handle Stripe onboarding callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSuccess = params.get('stripe_success');
    const stripeRefresh = params.get('stripe_refresh');
    const organizationId = params.get('organization_id');

    if (stripeSuccess === 'true' || stripeRefresh === 'true') {
      // Remove query parameters from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Invalidate queries to refresh organization data
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });

      if (stripeSuccess === 'true') {
        toast({
          title: "Stripe Onboarding Complete",
          description: organizationId 
            ? `Organization ${organizationId} has completed Stripe onboarding. Please verify the account status.`
            : "Stripe onboarding completed successfully.",
          variant: "default",
        });
      } else if (stripeRefresh === 'true') {
        toast({
          title: "Stripe Onboarding Incomplete",
          description: "The onboarding process was not completed. You can try again by clicking 'Create Stripe'.",
          variant: "default",
        });
      }
    }
  }, [queryClient, toast]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchInput.trim()) return;
    handleSearch();
  };

  // Auto-generate subdomain from organization name and check availability
  useEffect(() => {
    const name = newCustomer.name.trim();
    if (!name) {
      setNewCustomer(prev => ({ ...prev, subdomain: '' }));
      setSubdomainError('');
      return;
    }

    const generatedSubdomain = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]+/g, '')
      .replace(/^-+|-+$/g, '');
    
    setNewCustomer(prev => ({ ...prev, subdomain: generatedSubdomain }));

    // Check if subdomain exists via API
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/organizations/check-name?name=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[SAAS-ORGS] Name check error:", errorData);
          setSubdomainError("Unable to verify organization name right now.");
          return;
        }

        const data = await response.json();
        if (data.exists) {
          setSubdomainError(`Title\n"${generatedSubdomain}"\nThis title already exists. Please choose a different organization name.`);
        } else {
          setSubdomainError('');
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("[SAAS-ORGS] Name check failed:", err);
        setSubdomainError("Unable to verify organization name right now.");
      }
    }, 450);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [newCustomer.name]);

  // Check email availability from database (users and organizations tables)
  useEffect(() => {
    const checkEmailAvailability = async () => {
      if (newCustomer.adminEmail) {
        try {
          const response = await saasApiRequest('GET', `/api/saas/customers/check-email?email=${encodeURIComponent(newCustomer.adminEmail)}`);
          const data = await response.json();
          
          if (!data.emailAvailable) {
            setEmailError('Email already exists');
          } else {
            setEmailError('');
          }
        } catch (error) {
          console.error('Error checking email availability:', error);
          setEmailError('');
        }
      } else {
        setEmailError('');
      }
    };

    const timeoutId = setTimeout(checkEmailAvailability, 300);
    return () => clearTimeout(timeoutId);
  }, [newCustomer.adminEmail]);

  // Fetch available billing packages
  const { data: billingPackages } = useQuery({
    queryKey: ['/api/saas/packages'],
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await saasApiRequest('POST', '/api/saas/customers', customerData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      setIsAddDialogOpen(false);
      // Clear search filter to show new customer
      setSearchTerm('');
      setSelectedStatus('all');
      setSubdomainError('');
      setEmailError('');
      setSelectedPackageDetails(null);
      setNewCustomer({
        name: '', brandName: '', subdomain: '', adminEmail: '', 
        adminFirstName: '', adminLastName: '', accessLevel: 'full', billingPackageId: '',
        status: 'active', paymentStatus: 'paid',
        details: '', expiresAt: '',
        features: {
          maxUsers: 10, maxPatients: 100, aiEnabled: true, 
          telemedicineEnabled: true, billingEnabled: true, analyticsEnabled: true
        }
      });
      // Show success modal with appropriate message
      const message = data.emailSent === false
        ? 'Organization created successfully but email sending failed.'
        : 'Organization created successfully!';
      setSuccessMessage(message);
      setPermissionsOverview(DEFAULT_ROLE_PERMISSIONS);
      setShowPermissionsModal(true);
    },
    onError: (error: any) => {
      let errMsg = error.message || "Failed to create organization";
      
      // Parse JSON error message if present
      try {
        if (errMsg.startsWith('{') && errMsg.includes('"message"')) {
          const parsed = JSON.parse(errMsg);
          errMsg = parsed.message || errMsg;
        }
      } catch (e) {
        // If parsing fails, use the original message
      }
      
      setErrorMessage(errMsg);
      setIsErrorModalOpen(true);
    },
  });

  const handleCreateCustomer = () => {
    const normalizedExpiresAt = newCustomer.expiresAt
      ? ensureFutureOrNow(newCustomer.expiresAt)
      : '';
    createCustomerMutation.mutate({
      ...newCustomer,
      expiresAt: normalizedExpiresAt,
    });
  };

  const connectStripeMutation = useMutation({
    mutationFn: async (organizationId: number) => {
      const response = await saasApiRequest('POST', `/api/saas/organizations/${organizationId}/connect-stripe`);
      if (!response.ok) {
        const error = await response.json();
        // Preserve the full error object for better error handling
        const errorWithDetails = new Error(error.message || 'Failed to connect Stripe');
        (errorWithDetails as any).details = error;
        throw errorWithDetails;
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      
      // If onboarding URL is provided, redirect to Stripe onboarding
      if (data.onboardingUrl) {
        toast({
          title: "Redirecting to Stripe",
          description: "Please complete the Stripe onboarding process to enable payments.",
          variant: "default",
        });
        // Redirect to Stripe onboarding page
        window.location.href = data.onboardingUrl;
      } else {
        toast({
          title: "Success",
          description: data.message || "Stripe account created successfully",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      const errorDetails = error.details || {};
      let errorMessage = error.message || "Failed to connect Stripe account";
      let errorTitle = "Error";
      
      // Show more helpful message if Stripe Connect is not enabled
      if (errorDetails.error === "Stripe Connect not enabled" || 
          error.message?.includes("Connect") || 
          error.message?.includes("signed up for Connect")) {
        errorTitle = "Stripe Connect Not Enabled";
        errorMessage = errorDetails.message || "Stripe Connect is not enabled. Please enable Stripe Connect in your Stripe Dashboard.";
        
        // Add detailed instructions if available
        if (errorDetails.steps && Array.isArray(errorDetails.steps)) {
          errorMessage += "\n\nSteps to enable:\n" + errorDetails.steps.map((step: string, i: number) => `${i + 1}. ${step}`).join("\n");
        }
        
        // Add help URL if available
        if (errorDetails.helpUrl) {
          errorMessage += `\n\nVisit: ${errorDetails.helpUrl}`;
        }
      }
      
      // Check if organization already has a Stripe account
      if (errorDetails.message?.includes("already has a Stripe account")) {
        errorMessage = errorDetails.message || "Organization already has a Stripe account";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 12000, // Show longer for important errors
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await saasApiRequest('PATCH', `/api/saas/customers/${customerData.id}`, customerData);
      return response.json();
    },
    onSuccess: () => {
      const current = editingCustomer;
      const orgName = current?.name || 'organization';
      setUpdateSuccessMessage(`your organization ${orgName} has been updated successfully.`);
      setShowUpdateSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      setOriginalCustomerValues(null);
      setEditingCustomer(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  const handleViewCustomerDetails = async (customerId: number) => {
    setViewingCustomer(null);
    setIsViewCustomerLoading(true);

    try {
      const response = await saasApiRequest('GET', `/api/saas/customers/${customerId}`);
      const customerDetails = await response.json();
      const normalizedFeatures = parseFeatureConfig(customerDetails.features);

      setViewingCustomer({
        ...customerDetails,
        features: normalizedFeatures || undefined,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load customer details",
        variant: "destructive",
      });
    } finally {
      setIsViewCustomerLoading(false);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ organizationId, status }: { organizationId: number; status: string }) => {
      console.log('Status mutation called with:', { organizationId, status });
      const response = await saasApiRequest('PATCH', '/api/saas/customers/status', { organizationId, status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      toast({
        title: "Customer Status Updated",
        description: "Customer status changed successfully",
      });
    },
    onError: (error: any) => {
      console.error('Status update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update customer status",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (organizationId: number) => {
      const response = await saasApiRequest('DELETE', `/api/saas/organizations/${organizationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saas/customers'] });
      toast({
        title: "Customer Deleted",
        description: "Customer and all associated data have been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  const resetDeleteState = () => {
    setDeletePreviewData(null);
    setDeletePreviewError('');
    setDeleteSuccessMessage('');
    setDeleteErrorMessage('');
    setDeleteLogs([]);
    setDeletePreviewLoading(false);
  };

  const fetchDeletePreview = async (organizationId: number) => {
    setDeletePreviewLoading(true);
    setDeletePreviewError('');
    setDeleteLogs([`Fetching delete preview for organization ${organizationId}...`]);

    try {
      const response = await saasApiRequest('GET', `/api/saas/organizations/${organizationId}/delete-preview`);
      const preview = (await response.json()) as Record<string, number>;
      setDeletePreviewData(preview);

      const totalRows = Object.values(preview || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const tableCount = Object.keys(preview || {}).length;
      setDeleteLogs((prev) => [
        ...prev,
        `Preview ready: ${totalRows} rows tracked across ${tableCount} tables.`,
      ]);
    } catch (error: any) {
      const message = error?.message || 'Unable to load delete preview';
      setDeletePreviewError(message);
      setDeleteLogs((prev) => [...prev, `Preview failed: ${message}`]);
    } finally {
      setDeletePreviewLoading(false);
    }
  };

  const handlePrepareDelete = (customer: any) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
    resetDeleteState();
    if (customer?.id) {
      void fetchDeletePreview(customer.id);
    }
  };

  const handleConfirmDelete = () => {
    if (!customerToDelete) return;
    setDeleteErrorMessage('');
    setDeleteSuccessMessage('');
    setDeleteLogs((prev) => [
      ...prev,
      `Confirmed deletion for "${customerToDelete.name || 'organization'}".`,
      'Sending delete request to remove all linked tables...',
    ]);

    deleteCustomerMutation.mutate(customerToDelete.id, {
      onSuccess: (data: { deletedCounts?: Record<string, number> }) => {
        const counts = data?.deletedCounts || {};
        const summaryLines = Object.entries(counts).map(([key, value]) => `• ${formatDeleteTableLabel(key)}: ${value}`);
        const summaryHeader = summaryLines.length
          ? 'Deleted counts (final snapshot):'
          : 'No tracked rows were deleted.';
        setDeleteSuccessMessage('All related table rows have been permanently deleted.');
        setDeleteLogs((prev) => [
          ...prev,
          'Deletion completed successfully.',
          summaryHeader,
          ...summaryLines,
        ]);
        setDeleteErrorMessage('');
        // Close delete dialog and show success modal
        setIsDeleteDialogOpen(false);
        setIsDeleteSuccessModalOpen(true);
      },
      onError: (error: any) => {
        const message = error?.message || 'Failed to delete customer';
        setDeleteLogs((prev) => [...prev, `Deletion failed: ${message}`]);
        setDeleteErrorMessage(message);
      },
    });
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteDialogOpen(false);
    setCustomerToDelete(null);
    resetDeleteState();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800';
      case 'trial': return 'bg-cyan-100 text-cyan-800';
      case 'pending': return 'bg-purple-100 text-purple-800';
      case 'unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getExpiryAlertBadge = (level?: string) => {
    if (!level || level === 'none') return null;
    const config: Record<string, { text: string; className: string }> = {
      due_7: { text: '7 days to renew', className: 'bg-yellow-100 text-yellow-800' },
      due_1: { text: 'Renew tomorrow', className: 'bg-amber-100 text-amber-800' },
      expired: { text: 'Expired', className: 'bg-red-100 text-red-800' },
    };
    const badge = config[level] || { text: 'Renewal needed', className: 'bg-purple-100 text-purple-800' };
    return (
      <Badge className={badge.className}>
        {badge.text}
      </Badge>
    );
  };

  const normalizeValue = (value: any) => {
    if (value === undefined || value === null || value === '') {
      return 'Not set';
    }
    return value;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return 'Not set';
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (value?: string) => {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not set';
    return parsed.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseFeatureConfig = (features: any) => {
    if (!features) return null;
    if (typeof features === 'string') {
      try {
        return JSON.parse(features);
      } catch {
        return null;
      }
    }
    return features;
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span>Organization Management</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {customers?.length || 0} Total Customers
              </Badge>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setSubdomainError('');
                  setEmailError('');
                  setNewCustomer({
                    name: '', brandName: '', subdomain: '', adminEmail: '', 
                    adminFirstName: '', adminLastName: '', accessLevel: 'full', billingPackageId: '',
                    status: 'active', paymentStatus: 'paid',
                    details: '', expiresAt: '',
                    features: {
                      maxUsers: 10, maxPatients: 100, aiEnabled: true, 
                      telemedicineEnabled: true, billingEnabled: true, analyticsEnabled: true
                    }
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Organization</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
                  <DialogHeader>
                    <DialogTitle>Add New Customer Organization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Organization Details */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Organization Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="name">Organization Name *</Label>
                          <Input 
                            id="name" 
                            placeholder="e.g., Metro Medical Center" 
                            value={newCustomer.name}
                            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                            aria-invalid={Boolean(subdomainError)}
                          />
                          {subdomainError && (
                            <p className="text-xs text-red-600 mt-2 whitespace-pre-line font-medium">
                              {subdomainError}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="brandName">Brand Name</Label>
                          <Input 
                            id="brandName" 
                            placeholder="e.g., Metro Health" 
                            value={newCustomer.brandName}
                            onChange={(e) => setNewCustomer({...newCustomer, brandName: e.target.value})}
                          />
                        </div>
                      </div>
                      {newCustomer.subdomain && (
                        <div>
                          <Label>Title</Label>
                          <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded-md">
                            <code className="text-sm font-medium text-gray-800">
                              {newCustomer.subdomain}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Admin User Details */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Administrator Account</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="adminFirstName">First Name *</Label>
                          <Input 
                            id="adminFirstName" 
                            placeholder="John" 
                            value={newCustomer.adminFirstName}
                            onChange={(e) => setNewCustomer({...newCustomer, adminFirstName: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminLastName">Last Name *</Label>
                          <Input 
                            id="adminLastName" 
                            placeholder="Smith" 
                            value={newCustomer.adminLastName}
                            onChange={(e) => setNewCustomer({...newCustomer, adminLastName: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminEmail">Email *</Label>
                          <Input 
                            id="adminEmail" 
                            type="email" 
                            placeholder="admin@example.com" 
                            value={newCustomer.adminEmail}
                            onChange={(e) => setNewCustomer({...newCustomer, adminEmail: e.target.value})}
                          />
                          {emailError && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              {emailError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subscription Section */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Subscription</h3>
                      
                      <div>
                        <Label>Billing Package</Label>
                        <select 
                          className="w-full px-3 py-2 border rounded"
                          value={newCustomer.billingPackageId}
                          onChange={(e) => {
                            const selectedPackageId = e.target.value;
                            const selectedPackage = Array.isArray(billingPackages) 
                              ? billingPackages.find((pkg: any) => pkg.id.toString() === selectedPackageId)
                              : null;
                            
                            // Store selected package details
                            setSelectedPackageDetails(selectedPackage || null);
                            
                            // Calculate expiration date based on billing cycle
                            let expiresAt = '';
                            let details = '';
                            
                            if (selectedPackage && selectedPackage.billingCycle) {
                              const now = new Date();
                              const billingCycle = selectedPackage.billingCycle.toLowerCase();
                              
                              if (billingCycle === 'monthly') {
                                // Add 1 month for monthly
                                const expiryDate = new Date(now);
                                expiryDate.setMonth(expiryDate.getMonth() + 1);
                                expiresAt = formatLocalDateTime(expiryDate);
                              } else if (billingCycle === 'yearly' || billingCycle === 'annual') {
                                // Add 12 months (1 year) for yearly
                                const expiryDate = new Date(now);
                                expiryDate.setMonth(expiryDate.getMonth() + 12);
                                expiresAt = formatLocalDateTime(expiryDate);
                              } else {
                                // Default to 1 month for unknown cycles
                                const expiryDate = new Date(now);
                                expiryDate.setMonth(expiryDate.getMonth() + 1);
                                expiresAt = formatLocalDateTime(expiryDate);
                              }
                              
                              // Auto-populate details based on package
                              const detailsParts: string[] = [];
                              
                              // Add package name and billing cycle
                              detailsParts.push(`${selectedPackage.name} - ${billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)} subscription`);
                              
                              // Add description if available
                              if (selectedPackage.description) {
                                detailsParts.push(selectedPackage.description);
                              }
                              
                              // Add key features summary
                              if (selectedPackage.features) {
                                const featureList: string[] = [];
                                if (selectedPackage.features.maxUsers) {
                                  featureList.push(`${selectedPackage.features.maxUsers} users`);
                                }
                                if (selectedPackage.features.maxPatients) {
                                  featureList.push(`${selectedPackage.features.maxPatients} patients`);
                                }
                                if (selectedPackage.features.aiEnabled) {
                                  featureList.push('AI Features');
                                }
                                if (selectedPackage.features.telemedicineEnabled) {
                                  featureList.push('Telemedicine');
                                }
                                if (selectedPackage.features.billingEnabled) {
                                  featureList.push('Billing');
                                }
                                if (selectedPackage.features.analyticsEnabled) {
                                  featureList.push('Analytics');
                                }
                                
                                if (featureList.length > 0) {
                                  detailsParts.push(`Includes: ${featureList.join(', ')}`);
                                }
                              }
                              
                              details = detailsParts.join('. ');
                            } else if (!selectedPackageId) {
                              // If package is cleared, don't auto-update expiresAt or details (let user keep their values)
                              expiresAt = newCustomer.expiresAt;
                              details = newCustomer.details;
                            }
                            
                            // If Trial package is selected, automatically set payment status to "trial"
                            // If NOT Trial package, set payment status to "paid" (if it was "trial")
                            const updatedCustomer: any = { 
                              ...newCustomer, 
                              billingPackageId: selectedPackageId,
                              expiresAt: expiresAt || newCustomer.expiresAt,
                              details: details || newCustomer.details
                            };
                            if (selectedPackage && selectedPackage.name.toLowerCase() === 'trial') {
                              updatedCustomer.paymentStatus = 'trial';
                            } else if (newCustomer.paymentStatus === 'trial') {
                              // If switching away from Trial package and payment status was "trial", change to "paid"
                              updatedCustomer.paymentStatus = 'paid';
                            }
                            
                            setNewCustomer(updatedCustomer);
                          }}
                        >
                          <option value="">Select a billing package (optional)</option>
                          {Array.isArray(billingPackages) && billingPackages.map((pkg: any) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} - £{pkg.price}/{pkg.billingCycle}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty for trial customers or manual billing setup
                        </p>
                        
                        {/* Display package details when a package is selected */}
                        {selectedPackageDetails && (
                          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
                            <div className="space-y-2">
                              <div>
                                <span className="text-sm font-semibold text-gray-700">
                                  {selectedPackageDetails.name}
                                </span>
                                {selectedPackageDetails.price && (
                                  <span className="text-sm text-gray-600 ml-2">
                                    - £{selectedPackageDetails.price}/{selectedPackageDetails.billingCycle}
                                  </span>
                                )}
                              </div>
                              {selectedPackageDetails.description && (
                                <div className="text-xs text-gray-600">
                                  {selectedPackageDetails.description}
                                </div>
                              )}
                              {selectedPackageDetails.features && (
                                <div className="text-xs text-gray-600 mt-2">
                                  <div className="font-medium mb-1">Features:</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {selectedPackageDetails.features.maxUsers && (
                                      <li>Max Users: {selectedPackageDetails.features.maxUsers}</li>
                                    )}
                                    {selectedPackageDetails.features.maxPatients && (
                                      <li>Max Patients: {selectedPackageDetails.features.maxPatients}</li>
                                    )}
                                    {selectedPackageDetails.features.aiEnabled && (
                                      <li>AI Features Enabled</li>
                                    )}
                                    {selectedPackageDetails.features.telemedicineEnabled && (
                                      <li>Telemedicine Enabled</li>
                                    )}
                                    {selectedPackageDetails.features.billingEnabled && (
                                      <li>Billing Module Enabled</li>
                                    )}
                                    {selectedPackageDetails.features.analyticsEnabled && (
                                      <li>Analytics & Reports Enabled</li>
                                    )}
                                    {selectedPackageDetails.features.customBranding && (
                                      <li>Custom Branding</li>
                                    )}
                                    {selectedPackageDetails.features.prioritySupport && (
                                      <li>Priority Support</li>
                                    )}
                                    {selectedPackageDetails.features.storageGB && (
                                      <li>Storage: {selectedPackageDetails.features.storageGB} GB</li>
                                    )}
                                    {selectedPackageDetails.features.apiCallsPerMonth && (
                                      <li>API Calls: {selectedPackageDetails.features.apiCallsPerMonth}/month</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Subscription Status</Label>
                          <select 
                            className="w-full px-3 py-2 border rounded"
                            value={newCustomer.status}
                            onChange={(e) => setNewCustomer({...newCustomer, status: e.target.value})}
                          >
                            <option value="active">Active</option>
                          </select>
                        </div>

                        <div>
                          <Label>Payment Status</Label>
                          <select 
                            className="w-full px-3 py-2 border rounded"
                            value={newCustomer.paymentStatus}
                            onChange={(e) => setNewCustomer({...newCustomer, paymentStatus: e.target.value})}
                          >
                            {(() => {
                              // Check if selected billing package is "Trial"
                              const selectedPackage = Array.isArray(billingPackages) 
                                ? billingPackages.find((pkg: any) => pkg.id.toString() === newCustomer.billingPackageId)
                                : null;
                              const isTrialPackage = selectedPackage && selectedPackage.name.toLowerCase() === 'trial';
                              
                              // Only show "Trial" option if Trial package is selected
                              return (
                                <>
                                  {isTrialPackage && (
                                    <option value="trial">Trial</option>
                                  )}
                                  <option value="paid">Paid</option>
                                  <option value="unpaid">Unpaid</option>
                                  <option value="failed">Failed</option>
                                  <option value="pending">Pending</option>
                                </>
                              );
                            })()}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Details</Label>
                          <Input
                            type="text"
                            value={newCustomer.details}
                            onChange={(e) => setNewCustomer({...newCustomer, details: e.target.value})}
                            placeholder="Enter subscription details"
                          />
                        </div>

                        <div>
                          <Label>Expires At</Label>
                          <Input
                            type="datetime-local"
                            value={newCustomer.expiresAt}
                            min={minExpiresAt}
                            onChange={(e) => setNewCustomer({...newCustomer, expiresAt: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Access Level */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Access Level</h3>
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="full-access" 
                            name="accessLevel"
                            checked={newCustomer.accessLevel === 'full'}
                            onChange={() => setNewCustomer({...newCustomer, accessLevel: 'full'})}
                          />
                          <Label htmlFor="full-access" className="cursor-pointer">
                            <span className="font-medium">Full Access</span> - Complete access to all EMR features
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="limited-access" 
                            name="accessLevel"
                            checked={newCustomer.accessLevel === 'limited'}
                            onChange={() => setNewCustomer({...newCustomer, accessLevel: 'limited'})}
                          />
                          <Label htmlFor="limited-access" className="cursor-pointer">
                            <span className="font-medium">Limited Access</span> - Restricted feature set with custom controls
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Feature Controls */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-gray-700">Feature Configuration</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="maxUsers">Maximum Users</Label>
                          <Input 
                            id="maxUsers" 
                            type="number" 
                            min="1"
                            value={newCustomer.features.maxUsers}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, maxUsers: parseInt(e.target.value) || 1}
                            })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxPatients">Maximum Patients</Label>
                          <Input 
                            id="maxPatients" 
                            type="number" 
                            min="1"
                            value={newCustomer.features.maxPatients}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, maxPatients: parseInt(e.target.value) || 1}
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="aiEnabled">AI Features</Label>
                          <input 
                            type="checkbox" 
                            id="aiEnabled"
                            checked={newCustomer.features.aiEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, aiEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="telemedicineEnabled">Telemedicine</Label>
                          <input 
                            type="checkbox" 
                            id="telemedicineEnabled"
                            checked={newCustomer.features.telemedicineEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, telemedicineEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="billingEnabled">Billing Module</Label>
                          <input 
                            type="checkbox" 
                            id="billingEnabled"
                            checked={newCustomer.features.billingEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, billingEnabled: e.target.checked}
                            })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="analyticsEnabled">Analytics & Reports</Label>
                          <input 
                            type="checkbox" 
                            id="analyticsEnabled"
                            checked={newCustomer.features.analyticsEnabled}
                            onChange={(e) => setNewCustomer({
                              ...newCustomer, 
                              features: {...newCustomer.features, analyticsEnabled: e.target.checked}
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          setSelectedPackageDetails(null);
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateCustomer}
                        disabled={createCustomerMutation.isPending || !newCustomer.name || !newCustomer.subdomain || !newCustomer.adminEmail || !newCustomer.adminFirstName || !newCustomer.adminLastName || !!subdomainError || !!emailError}
                        className="flex-1"
                      >
                        {createCustomerMutation.isPending ? 'Creating...' : 'Create Organization'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 overflow-x-hidden p-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Type name, domain, or email and hit Enter"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-10"
                />
                {(searchTerm || searchInput) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSearchInput('');
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                    style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                type="submit"
                disabled={!searchInput.trim()}
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Customers Table */}
          <div className="border rounded-lg overflow-hidden relative w-full">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div className="w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Organization</TableHead>
                    <TableHead className="hidden lg:table-cell w-[100px]">Title</TableHead>
                    <TableHead className="w-[70px]">Users</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="hidden xl:table-cell w-[90px]">Org Pay</TableHead>
                    <TableHead className="hidden md:table-cell w-[130px]">Package</TableHead>
                    <TableHead className="hidden 2xl:table-cell w-[150px]">Start</TableHead>
                    <TableHead className="hidden xl:table-cell w-[150px]">Expires</TableHead>
                    <TableHead className="hidden lg:table-cell w-[100px]">Days</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers?.map((customer: any) => (
                    <TableRow key={customer.id}>
                    <TableCell className="w-[200px]">
                      <div>
                        <div className="font-medium truncate">{customer.name}</div>
                        <div className="text-xs text-gray-500 truncate">{customer.brandName}</div>
                        <div className="hidden lg:block">
                          {customer.adminEmail && (
                            <div className="text-xs text-gray-400 truncate">{customer.adminEmail}</div>
                          )}
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block truncate max-w-full">
                            {customer.subdomain}
                          </code>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell w-[100px]">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded truncate block">
                        {customer.subdomain}
                      </code>
                    </TableCell>
                    <TableCell className="w-[70px]">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm">{customer.userCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[100px]">
                      <div className="flex flex-col gap-1">
                        <Badge className={`${getStatusBadgeColor(customer.computedSubscriptionStatus || customer.subscriptionStatus)} text-xs`}>
                          {customer.computedSubscriptionStatus || customer.subscriptionStatus}
                        </Badge>
                        <Badge className={`hidden xl:inline-flex text-xs ${getPaymentBadgeColor(customer.organizationPaymentStatus)}`}>
                          {customer.organizationPaymentStatus || 'trial'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell w-[90px]">
                      <Badge className={`${getPaymentBadgeColor(customer.organizationPaymentStatus)} text-xs`}>
                        {customer.organizationPaymentStatus || 'trial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell w-[130px] text-sm">
                      <div className="truncate" title={customer.packageName || 'No Package'}>
                        {customer.packageName || 'No Package'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell w-[150px] text-xs">
                      <div className="truncate">
                        {formatDateTime(customer.subscriptionStart)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell w-[150px] text-xs">
                      <div className="truncate">
                        {formatDateTime(customer.expiresAt)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell w-[100px] text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{formatDaysActive(customer.daysActive)}</span>
                        {getExpiryAlertBadge(customer.expiryAlertLevel)}
                      </div>
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* View Details */}
                          <Dialog
                            onOpenChange={(open) => {
                              if (!open) {
                                setViewingCustomer(null);
                                setIsViewCustomerLoading(false);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault();
                                handleViewCustomerDetails(customer.id);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader className="flex items-start justify-between gap-3 flex-shrink-0">
                              <DialogTitle>Customer Details - {customer.name}</DialogTitle>
                              <DialogClose asChild>
                                <button
                                  type="button"
                                  className="text-gray-500 rounded hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                  ✕
                                </button>
                              </DialogClose>
                            </DialogHeader>
                            {isViewCustomerLoading ? (
                              <div className="py-12 flex justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-dashed border-blue-300 border-t-blue-600" />
                              </div>
                            ) : viewingCustomer ? (
                              <div className="h-[550px] overflow-y-auto pr-2">
                              <div className="space-y-4 text-sm text-gray-700">
                                <section className="space-y-1.5">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Organization summary
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.name)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Brand</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.brandName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Title</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.subdomain)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Created</p>
                                      <p className="font-semibold text-gray-900">{formatDate(viewingCustomer.createdAt)}</p>
                                    </div>
                                  </div>
                                          <div className="flex flex-wrap gap-2">
                                            {[
                                              { label: viewingCustomer.subscriptionStatus, type: 'status' as const },
                                              { label: viewingCustomer.organizationPaymentStatus, type: 'payment' as const },
                                              { label: viewingCustomer.subscriptionPaymentStatus, type: 'payment' as const },
                                              { label: viewingCustomer.paymentStatus, type: 'payment' as const },
                                            ]
                                              .filter((entry) => entry.label)
                                              .reduce((acc: { label: string; type: 'status' | 'payment' }[], entry) => {
                                                const normalized = entry.label.toLowerCase();
                                                if (!acc.some((existing) => existing.label.toLowerCase() === normalized)) {
                                                  acc.push(entry);
                                                }
                                                return acc;
                                              }, [])
                                              .map((entry) => {
                                                const normalized = entry.label.toLowerCase();
                                                const badgeClass =
                                                  entry.type === 'status'
                                                    ? getStatusBadgeColor(normalized)
                                                    : getPaymentBadgeColor(normalized);
                                                return (
                                                  <Badge key={`${entry.type}-${normalized}`} className={badgeClass}>
                                                    {entry.label}
                                                  </Badge>
                                                );
                                              })}
                                          </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Subscription & Billing
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Package</p>
                                      <p className="font-semibold text-gray-900">
                                        {viewingCustomer.packageName || `Package ID ${viewingCustomer.packageId || 'N/A'}`}
                                      </p>
                                      {(viewingCustomer.packagePrice || viewingCustomer.packageBillingCycle) && (
                                        <p className="text-xs text-gray-500">
                                          {viewingCustomer.packagePrice
                                            ? formatCurrency(parseFloat(String(viewingCustomer.packagePrice)))
                                            : ""}
                                          {viewingCustomer.packageBillingCycle
                                            ? ` / ${viewingCustomer.packageBillingCycle}`
                                            : ""}
                                        </p>
                                      )}
                                      {viewingCustomer.packageDescription && (
                                        <p className="text-xs text-gray-500">{viewingCustomer.packageDescription}</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Payment Status</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.paymentStatus)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Subscription Payment</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.subscriptionPaymentStatus)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Details</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.details)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Subscription Start</p>
                                      <p className="font-semibold text-gray-900">
                                        {formatDateTime(viewingCustomer.subscriptionStart)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Expires At</p>
                                      <p className="font-semibold text-gray-900">{formatDateTime(viewingCustomer.expiresAt)}</p>
                                      <p className="text-xs text-gray-500">Includes 7-day grace period</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Days Active</p>
                                      <p className="font-semibold text-gray-900">
                                        {formatDaysActive(viewingCustomer.daysActive)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Days Left</p>
                                      <p className="font-semibold text-gray-900">
                                        {viewingCustomer.daysLeft ?? "—"}
                                      </p>
                                    </div>
                                    {viewingCustomer.expiryAlertLevel && viewingCustomer.expiryAlertLevel !== 'none' && (
                                      <div>
                                        <p className="text-xs text-gray-500">Expiry Alert</p>
                                        {getExpiryAlertBadge(viewingCustomer.expiryAlertLevel)}
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-gray-500">Last Updated</p>
                                      <p className="font-semibold text-gray-900">{formatDateTime(viewingCustomer.updatedAt)}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-xs text-gray-500">Package features</p>
                                      <div className="flex flex-wrap gap-2">
                                        {packageFeatureList.map((feature) => (
                                          <span
                                            key={feature}
                                            className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700"
                                          >
                                            {feature}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Administrator
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-gray-500">First Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminFirstName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Last Name</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminLastName)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Email</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.adminEmail)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Access Level</p>
                                      <p className="font-semibold text-gray-900">{normalizeValue(viewingCustomer.accessLevel)}</p>
                                    </div>
                                  </div>
                                </section>

                                <section className="space-y-2">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">
                                    Feature configuration
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    {viewingFeatureFlags.map((flag) => (
                                      <div key={flag.label}>
                                        <p className="text-xs text-gray-500">{flag.label}</p>
                                        <p className="font-semibold text-gray-900">
                                          {flag.value ? 'Enabled' : 'Disabled'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Maximum Users</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.features?.maxUsers)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Maximum Patients</p>
                                      <p className="font-semibold text-gray-900">
                                        {normalizeValue(viewingCustomer.features?.maxPatients)}
                                      </p>
                                    </div>
                                  </div>
                                </section>
                                </div>
                              </div>
                            ) : (
                              <p className="text-center text-sm text-gray-500 py-6">
                                No customer details available right now.
                              </p>
                            )}
                          </DialogContent>
                        </Dialog>
                          <DropdownMenuSeparator />
                          {/* Edit Customer */}
                          <Dialog open={editingCustomer?.id === customer.id} onOpenChange={(open) => {
                            if (!open) {
                              setEditingCustomer(null);
                              setOriginalCustomerValues(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <DropdownMenuItem onSelect={async (e) => {
                                e.preventDefault();
                                try {
                                  const response = await saasApiRequest('GET', `/api/saas/customers/${customer.id}`);
                                  const customerDetails = await response.json();
                                  
                                  // Get billingPackageId from either billingPackageId or packageId field
                                  const packageId = customerDetails.billingPackageId || customerDetails.packageId;
                                  
                                  setEditingCustomer({
                                    id: customerDetails.id,
                                    name: customerDetails.name,
                                    brandName: customerDetails.brandName,
                                    subdomain: customerDetails.subdomain,
                                    adminEmail: customerDetails.adminEmail || '',
                                    adminFirstName: customerDetails.adminFirstName || '',
                                    adminLastName: customerDetails.adminLastName || '',
                                    accessLevel: customerDetails.accessLevel || 'full',
                                    subscriptionStatus: customerDetails.subscriptionStatus || 'trial',
                                    paymentStatus: customerDetails.paymentStatus || customerDetails.subscriptionPaymentStatus || 'trial',
                                    organizationPaymentStatus: customerDetails.organizationPaymentStatus || 'trial',
                                    subscriptionPaymentStatus: customerDetails.subscriptionPaymentStatus || customerDetails.paymentStatus || 'trial',
                                    billingPackageId: packageId ? String(packageId) : '',
                                    packageName: customerDetails.packageName || '',
                                    packagePrice: customerDetails.packagePrice || null,
                                    packageBillingCycle: customerDetails.packageBillingCycle || '',
                                    packageDescription: customerDetails.packageDescription || '',
                                    packageFeatures: customerDetails.packageFeatures || customerDetails.features || {},
                                    details: customerDetails.details || '',
                                    expiresAt: customerDetails.expiresAt ? new Date(customerDetails.expiresAt).toISOString().slice(0, 16) : '',
                                    features: customerDetails.features ? (typeof customerDetails.features === 'string' ? JSON.parse(customerDetails.features) : customerDetails.features) : {
                                      maxUsers: 10,
                                      maxPatients: 100,
                                      aiEnabled: true,
                                      telemedicineEnabled: true,
                                      billingEnabled: true,
                                      analyticsEnabled: true,
                                    }
                                  });
                                  // Get billingPackageId from either billingPackageId or packageId field for original values
                                  const originalPackageId = customerDetails.billingPackageId || customerDetails.packageId;
                                  
                                  setOriginalCustomerValues({
                                    subscriptionStatus: customerDetails.subscriptionStatus || 'trial',
                                    paymentStatus: customerDetails.paymentStatus || customerDetails.subscriptionPaymentStatus || 'trial',
                                    organizationPaymentStatus: customerDetails.organizationPaymentStatus || 'trial',
                                    subscriptionPaymentStatus: customerDetails.subscriptionPaymentStatus || customerDetails.paymentStatus || 'trial',
                                    billingPackageId: originalPackageId ? String(originalPackageId) : '',
                                    details: customerDetails.details || '',
                                    expiresAt: customerDetails.expiresAt ? new Date(customerDetails.expiresAt).toISOString().slice(0, 16) : '',
                                  });
                                } catch (error) {
                                  console.error('Error fetching customer details:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load customer details",
                                    variant: "destructive",
                                  });
                                }
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[9999]">
                          <DialogHeader>
                            <DialogTitle>Edit Organization - {customer.name}</DialogTitle>
                          </DialogHeader>
                          {editingCustomer && (
                            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                                Current values from the database
                              </p>
                              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div>
                                  <dt className="text-[11px] text-gray-500">Billing Package</dt>
                                  <dd className="font-semibold">
                                    {editingCustomer.packageName 
                                      ? `${editingCustomer.packageName}${editingCustomer.packagePrice ? ` - £${editingCustomer.packagePrice}` : ''}${editingCustomer.packageBillingCycle ? `/${editingCustomer.packageBillingCycle}` : ''}`
                                      : 'No package assigned'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Organization status</dt>
                                  <dd className="font-semibold">{editingCustomer.subscriptionStatus}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Org payment status</dt>
                                  <dd className="font-semibold">{editingCustomer.organizationPaymentStatus || 'not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Subscription payment</dt>
                                  <dd className="font-semibold">{editingCustomer.subscriptionPaymentStatus || 'not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Details</dt>
                                  <dd className="font-semibold">{editingCustomer.details || 'Not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Expires at</dt>
                                  <dd className="font-semibold">
                                    {editingCustomer.expiresAt ? new Date(editingCustomer.expiresAt).toLocaleString() : 'Not set'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Current max users</dt>
                                  <dd className="font-semibold">{editingCustomer.features?.maxUsers ?? 'Not set'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-gray-500">Current max patients</dt>
                                  <dd className="font-semibold">{editingCustomer.features?.maxPatients ?? 'Not set'}</dd>
                                </div>
                              </dl>
                            </div>
                          )}
                            {editingCustomer && (
                              <div className="space-y-4">
                                {/* Organization Details */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700">Organization Details</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label>Organization Name</Label>
                                      <Input 
                                        value={editingCustomer.name}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Brand Name</Label>
                                      <Input 
                                        value={editingCustomer.brandName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, brandName: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Title</Label>
                                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                      <code className="text-sm font-medium text-gray-800">
                                        {editingCustomer.subdomain}
                                      </code>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Title cannot be changed after creation</p>
                                  </div>
                                </div>

                                {/* Administrator Account */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700">Administrator Account</h3>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <Label>First Name</Label>
                                      <Input 
                                        value={editingCustomer.adminFirstName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminFirstName: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Last Name</Label>
                                      <Input 
                                        value={editingCustomer.adminLastName}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminLastName: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Email</Label>
                                      <Input 
                                        type="email"
                                        value={editingCustomer.adminEmail}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, adminEmail: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Subscription Section */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700">Subscription</h3>
                                  
                                  <div>
                                    <Label>Billing Package</Label>
                                    <select 
                                      className="w-full px-3 py-2 border rounded"
                                      value={editingCustomer.billingPackageId || ''}
                                      onChange={(e) => {
                                        const selectedPkgId = e.target.value;
                                        const selectedPkg = billingPackages?.find((pkg: any) => String(pkg.id) === selectedPkgId);
                                        
                                        // Calculate expiresAt based on billing cycle
                                        let expiresAt = editingCustomer.expiresAt; // Keep existing value if no package selected
                                        if (selectedPkg && selectedPkg.billingCycle) {
                                          const now = new Date();
                                          const billingCycle = selectedPkg.billingCycle.toLowerCase();
                                          
                                          if (billingCycle === 'monthly') {
                                            // Add 1 month for monthly billing
                                            const expiryDate = new Date(now);
                                            expiryDate.setMonth(expiryDate.getMonth() + 1);
                                            expiresAt = expiryDate.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
                                          } else if (billingCycle === 'yearly' || billingCycle === 'annual') {
                                            // Add 12 months (1 year) for yearly billing
                                            const expiryDate = new Date(now);
                                            expiryDate.setMonth(expiryDate.getMonth() + 12);
                                            expiresAt = expiryDate.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
                                          } else {
                                            // Default to 1 month for unknown cycles
                                            const expiryDate = new Date(now);
                                            expiryDate.setMonth(expiryDate.getMonth() + 1);
                                            expiresAt = expiryDate.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
                                          }
                                        } else if (!selectedPkgId) {
                                          // If package is cleared, keep existing expiresAt value
                                          expiresAt = editingCustomer.expiresAt;
                                        }
                                        
                                        setEditingCustomer({
                                          ...editingCustomer, 
                                          billingPackageId: selectedPkgId,
                                          packageName: selectedPkg?.name || '',
                                          packagePrice: selectedPkg?.price || null,
                                          packageBillingCycle: selectedPkg?.billingCycle || '',
                                          packageDescription: selectedPkg?.description || '',
                                          packageFeatures: selectedPkg?.features || {},
                                          expiresAt: expiresAt,
                                        });
                                      }}
                                    >
                                      <option value="">Select a billing package (optional)</option>
                                      {Array.isArray(billingPackages) && billingPackages.map((pkg: any) => (
                                        <option key={pkg.id} value={String(pkg.id)}>
                                          {pkg.name} - £{pkg.price}/{pkg.billingCycle}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Assign or change billing package for this customer
                                    </p>
                                    
                                    {/* Display selected package details */}
                                    {editingCustomer.billingPackageId && editingCustomer.packageName && (
                                      <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                                        <h4 className="font-semibold text-sm text-gray-900 mb-2">
                                          {editingCustomer.packageName} - £{editingCustomer.packagePrice}/{editingCustomer.packageBillingCycle}
                                        </h4>
                                        {editingCustomer.packageDescription && (
                                          <p className="text-xs text-gray-600 mb-3">{editingCustomer.packageDescription}</p>
                                        )}
                                        <p className="text-xs font-medium text-gray-700 mb-2">Features:</p>
                                        <ul className="text-xs text-gray-600 space-y-1">
                                          {editingCustomer.packageFeatures?.maxUsers && (
                                            <li>• Max Users: {editingCustomer.packageFeatures.maxUsers}</li>
                                          )}
                                          {editingCustomer.packageFeatures?.maxPatients && (
                                            <li>• Max Patients: {editingCustomer.packageFeatures.maxPatients}</li>
                                          )}
                                          {editingCustomer.packageFeatures?.aiEnabled && (
                                            <li>• AI Features Enabled</li>
                                          )}
                                          {editingCustomer.packageFeatures?.telemedicineEnabled && (
                                            <li>• Telemedicine Enabled</li>
                                          )}
                                          {editingCustomer.packageFeatures?.billingEnabled && (
                                            <li>• Billing Module Enabled</li>
                                          )}
                                          {editingCustomer.packageFeatures?.analyticsEnabled && (
                                            <li>• Analytics & Reports Enabled</li>
                                          )}
                                          {editingCustomer.packageFeatures?.customBranding && (
                                            <li>• Custom Branding</li>
                                          )}
                                          {editingCustomer.packageFeatures?.prioritySupport && (
                                            <li>• Priority Support</li>
                                          )}
                                          {editingCustomer.packageFeatures?.storageGB && (
                                            <li>• Storage: {editingCustomer.packageFeatures.storageGB} GB</li>
                                          )}
                                          {editingCustomer.packageFeatures?.apiCallsPerMonth && (
                                            <li>• API Calls: {editingCustomer.packageFeatures.apiCallsPerMonth}/month</li>
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label>Subscription Status</Label>
                                      <select 
                                        className="w-full px-3 py-2 border rounded"
                                        value={editingCustomer.subscriptionStatus}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, subscriptionStatus: e.target.value})}
                                      >
                                        {(() => {
                                          // Check if selected package is Trial package
                                          const selectedPkg = editingCustomer.billingPackageId 
                                            ? billingPackages?.find((pkg: any) => String(pkg.id) === String(editingCustomer.billingPackageId))
                                            : null;
                                          const isTrialPackage = selectedPkg && 
                                            selectedPkg.name.toLowerCase().includes('trial') &&
                                            (parseFloat(selectedPkg.price || '0') === 0 || selectedPkg.price === '0.00' || selectedPkg.price === 0);
                                          
                                          // If Trial package is selected, only show "Active" option
                                          if (isTrialPackage) {
                                            return <option value="active">Active</option>;
                                          }
                                          
                                          // Otherwise, show all options except Trial
                                          return (
                                            <>
                                        <option value="active">Active</option>
                                        <option value="expired">Expired</option>
                                        <option value="cancelled">Cancelled</option>
                                            </>
                                          );
                                        })()}
                                      </select>
                                    </div>

                                    <div>
                                      <Label>Payment Status</Label>
                                      <select 
                                        className="w-full px-3 py-2 border rounded"
                                        value={editingCustomer.paymentStatus}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, paymentStatus: e.target.value})}
                                      >
                                        {(() => {
                                          // Check if selected package is Trial package
                                          const selectedPkg = editingCustomer.billingPackageId 
                                            ? billingPackages?.find((pkg: any) => String(pkg.id) === String(editingCustomer.billingPackageId))
                                            : null;
                                          const isTrialPackage = selectedPkg && 
                                            selectedPkg.name.toLowerCase().includes('trial') &&
                                            (parseFloat(selectedPkg.price || '0') === 0 || selectedPkg.price === '0.00' || selectedPkg.price === 0);
                                          
                                          // If Trial package is selected, only show "Trial" option
                                          if (isTrialPackage) {
                                            return <option value="trial">Trial</option>;
                                          }
                                          
                                          // Otherwise, show all options except Trial
                                          return (
                                            <>
                                        <option value="paid">Paid</option>
                                        <option value="unpaid">Unpaid</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                            </>
                                          );
                                        })()}
                                      </select>
                                    <div className="text-xs text-gray-500 space-y-1 mt-1">
                                      <div>
                                        <span className="font-semibold">Org row:</span>{" "}
                                        {editingCustomer.organizationPaymentStatus || 'trial'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">Subscription row:</span>{" "}
                                        {editingCustomer.subscriptionPaymentStatus || editingCustomer.paymentStatus || 'trial'}
                                      </div>
                                    </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label>Details</Label>
                                      <Input
                                        type="text"
                                        value={editingCustomer.details}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, details: e.target.value})}
                                        placeholder="Enter subscription details"
                                      />
                                    </div>

                                    <div>
                                      <Label>Expires At</Label>
                                      <Input
                                        type="datetime-local"
                                        value={editingCustomer.expiresAt}
                                        onChange={(e) => setEditingCustomer({...editingCustomer, expiresAt: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Access Level */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700">Access Level</h3>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="radio" 
                                        id="edit-full-access" 
                                        name="editAccessLevel"
                                        checked={editingCustomer.accessLevel === 'full'}
                                        onChange={() => setEditingCustomer({...editingCustomer, accessLevel: 'full'})}
                                      />
                                      <Label htmlFor="edit-full-access" className="cursor-pointer">
                                        <span className="font-medium">Full Access</span> - Complete access to all EMR features
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="radio" 
                                        id="edit-limited-access" 
                                        name="editAccessLevel"
                                        checked={editingCustomer.accessLevel === 'limited'}
                                        onChange={() => setEditingCustomer({...editingCustomer, accessLevel: 'limited'})}
                                      />
                                      <Label htmlFor="edit-limited-access" className="cursor-pointer">
                                        <span className="font-medium">Limited Access</span> - Restricted feature set with custom controls
                                      </Label>
                                    </div>
                                  </div>
                                </div>

                                {/* Feature Configuration */}
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700">Feature Configuration</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label>Maximum Users</Label>
                                      <Input 
                                        type="number" 
                                        min="1"
                                        value={editingCustomer.features.maxUsers}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, maxUsers: parseInt(e.target.value) || 1}
                                        })}
                                      />
                                    </div>
                                    <div>
                                      <Label>Maximum Patients</Label>
                                      <Input 
                                        type="number" 
                                        min="1"
                                        value={editingCustomer.features.maxPatients}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, maxPatients: parseInt(e.target.value) || 1}
                                        })}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between">
                                      <Label>AI Features</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.aiEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, aiEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Telemedicine</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.telemedicineEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, telemedicineEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Billing Module</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.billingEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, billingEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Analytics & Reports</Label>
                                      <input 
                                        type="checkbox" 
                                        checked={editingCustomer.features.analyticsEnabled}
                                        onChange={(e) => setEditingCustomer({
                                          ...editingCustomer, 
                                          features: {...editingCustomer.features, analyticsEnabled: e.target.checked}
                                        })}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex space-x-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => {
                                      setEditingCustomer(null);
                                      setOriginalCustomerValues(null);
                                    }}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => updateCustomerMutation.mutate(editingCustomer)}
                                    disabled={updateCustomerMutation.isPending}
                                    className="flex-1"
                                  >
                                    {updateCustomerMutation.isPending ? 'Updating...' : 'Update Organization'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                          {/* Create Stripe - Show only if organization doesn't have Stripe account */}
                          {!customer.stripeAccountId && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  connectStripeMutation.mutate(customer.id);
                                }}
                                disabled={connectStripeMutation.isPending}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                {connectStripeMutation.isPending ? 'Creating...' : 'Create Stripe'}
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Delete */}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              console.log('🗑️ DELETE button clicked for customer:', customer.id, customer.name);
                              handlePrepareDelete(customer);
                            }}
                            disabled={deleteCustomerMutation.isPending || isPopupOpen}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>

          {customers?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No customers found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="z-[9999] sm:max-w-md">
          <button
            onClick={() => setIsSuccessModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Organization Created Successfully</DialogTitle>
            </DialogHeader>
            <p className="text-center text-gray-600">
              {successMessage}
            </p>
            <Button 
              onClick={() => setIsSuccessModalOpen(false)}
              className="bg-blue-600 hover:bg-blue-700 px-8"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionsModal} onOpenChange={(open) => {
        if (!open) {
          setShowPermissionsModal(false);
        }
      }}>
        <DialogContent className="w-[550px] h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assigned Permissions</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <p className="text-sm text-gray-600">
              Every new organization receives 15 default roles. All roles have view access to all 21 modules (Dashboard, Patients, Appointments, Prescriptions, Lab Results, Imaging, Forms, Messaging, Analytics, Clinical Decision Support, Symptom Checker, Telemedicine, Voice Documentation, Financial Intelligence, Billing, QuickBooks, Inventory, Shift Management, Settings, Subscription/Packages, User Manual). Edit, create, and delete permissions vary by role.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2">
              {permissionsOverview.map((entry) => (
                <li key={entry.role}>
                  <strong>{entry.role}</strong>: {entry.detail}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button onClick={handlePermissionsConfirmed}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent className="z-[9999]">
          <DialogHeader>
            <DialogTitle>Customer Creation Failed</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-gray-700">
              {errorMessage}
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => setIsErrorModalOpen(false)} variant="destructive">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDeleteModal();
          }
        }}
      >
        <DialogContent className="max-w-3xl space-y-4 z-[9999]">
          <DialogHeader>
            <DialogTitle>Delete Organization & Related Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-600">
              This action will purge every linked row for{' '}
              <strong>{customerToDelete?.name || 'the selected organization'}</strong>. Are you sure you want to delete every table row?
            </p>

            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Preview</p>
              {deletePreviewLoading ? (
                <p className="mt-2 text-xs text-gray-500">Loading related table counts...</p>
              ) : deletePreviewError ? (
                <p className="mt-2 text-xs text-red-600">{deletePreviewError}</p>
              ) : deletePreviewData ? (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(deletePreviewData).map(([key, count]) => (
                    <div key={key} className="flex justify-between text-xs font-semibold text-gray-800">
                      <span>{formatDeleteTableLabel(key)}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No preview data available.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-900/5 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Deletion log</span>
                {deleteCustomerMutation.isPending && <span className="text-emerald-600">Running...</span>}
              </div>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs font-mono text-slate-700">
                {deleteLogs.length === 0 ? (
                  <li className="text-xs text-slate-500">No activity yet.</li>
                ) : (
                  deleteLogs.map((log, index) => (
                    <li key={`${log}-${index}`}>{log}</li>
                  ))
                )}
              </ul>
            </div>

            {deleteErrorMessage && <p className="text-sm text-red-600">{deleteErrorMessage}</p>}
            {deleteSuccessMessage && <p className="text-sm text-emerald-600">{deleteSuccessMessage}</p>}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCloseDeleteModal}
              disabled={deleteCustomerMutation.isPending}
            >
              {deleteSuccessMessage ? 'Close' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={
                deleteCustomerMutation.isPending ||
                deletePreviewLoading ||
                Boolean(deletePreviewError) ||
                Boolean(deleteSuccessMessage)
              }
            >
              {deleteCustomerMutation.isPending
                ? 'Deleting...'
                : deleteSuccessMessage
                ? 'Deleted'
                : 'Delete Everything'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  <Dialog
    open={showUpdateSuccessModal}
    onOpenChange={(open) => {
      setShowUpdateSuccessModal(open);
      if (!open) {
        setUpdateSuccessMessage('');
      }
    }}
  >
      <DialogContent className="max-w-sm z-[9999]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-500" />
          <span className="text-emerald-600">Organization updated</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {updateSuccessMessage || 'your organization has been updated successfully.'}
        </p>
      </div>
      <div className="pt-4 flex justify-end">
        <Button onClick={() => setShowUpdateSuccessModal(false)}>OK</Button>
      </div>
    </DialogContent>
  </Dialog>

      {/* Delete Success Modal */}
      <Dialog open={isDeleteSuccessModalOpen} onOpenChange={setIsDeleteSuccessModalOpen}>
        <DialogContent className="z-[9999] sm:max-w-md">
          <button
            onClick={() => setIsDeleteSuccessModalOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Organization Deleted Successfully</DialogTitle>
            </DialogHeader>
            <p className="text-center text-gray-600">
              The organization "{customerToDelete?.name || 'organization'}" and all related data have been permanently deleted.
            </p>
            <Button 
              onClick={() => {
                setIsDeleteSuccessModalOpen(false);
                setCustomerToDelete(null);
                resetDeleteState();
              }}
              className="bg-blue-600 hover:bg-blue-700 px-8"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
</div>
  );
}