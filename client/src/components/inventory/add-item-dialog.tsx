import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AddCategoryDialog from "./add-category-dialog";

interface InventoryCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    genericName: "",
    brandName: "",
    manufacturer: "",
    categoryId: "",
    unitOfMeasurement: "",
    packSize: 1,
    purchasePrice: "",
    salePrice: "",
    mrp: "",
    taxRate: "20.00",
    currentStock: 0,
    minimumStock: 0,
    maximumStock: 0,
    reorderPoint: 0,
    prescriptionRequired: false,
    storageConditions: "",
    dosageInstructions: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory/categories"],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      // Ensure numeric fields have proper values, keep prices as strings for Zod validation
      const itemData = {
        ...data,
        categoryId: data.categoryId && data.categoryId !== "" ? parseInt(data.categoryId) : null,
        packSize: data.packSize && data.packSize !== "" ? parseInt(data.packSize) : 1,
        purchasePrice: data.purchasePrice && data.purchasePrice !== "" ? data.purchasePrice : "0.00",
        salePrice: data.salePrice && data.salePrice !== "" ? data.salePrice : "0.00",
        mrp: data.mrp && data.mrp !== "" ? data.mrp : "0.00",
        taxRate: data.taxRate && data.taxRate !== "" ? data.taxRate : "20.00",
        currentStock: data.currentStock && data.currentStock !== "" ? parseInt(data.currentStock) : 0,
        minimumStock: data.minimumStock && data.minimumStock !== "" ? parseInt(data.minimumStock) : 10,
        maximumStock: data.maximumStock && data.maximumStock !== "" ? parseInt(data.maximumStock) : 1000,
        reorderPoint: data.reorderPoint && data.reorderPoint !== "" ? parseInt(data.reorderPoint) : 20,
      };
      
      await apiRequest("POST", "/api/inventory/items", itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/reports/value"] });
      resetForm();
      // Close the main dialog first
      onOpenChange(false);
      // Then show success modal after a short delay to ensure main dialog is closed
      setTimeout(() => {
        setSuccessMessage("Item successfully added to inventory");
        setShowSuccessModal(true);
      }, 300);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add inventory item",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      sku: "",
      barcode: "",
      genericName: "",
      brandName: "",
      manufacturer: "",
      categoryId: "",
      unitOfMeasurement: "",
      packSize: 1,
      purchasePrice: "",
      salePrice: "",
      mrp: "",
      taxRate: "20.00",
      currentStock: 0,
      minimumStock: 0,
      maximumStock: 0,
      reorderPoint: 0,
      prescriptionRequired: false,
      storageConditions: "",
      dosageInstructions: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.sku || !formData.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, SKU, Category).",
        variant: "destructive",
      });
      return;
    }

    addItemMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new item to your healthcare inventory. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Paracetamol 500mg"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Brief description of the item"
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => handleInputChange("sku", e.target.value)}
                  placeholder="e.g., TAB-PARA500-001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => handleInputChange("barcode", e.target.value)}
                  placeholder="Product barcode"
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <div className="flex space-x-2">
                  <Select value={formData.categoryId} onValueChange={(value) => handleInputChange("categoryId", value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowCategoryDialog(true)}
                    className="px-3"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Product Details</h3>
              
              <div>
                <Label htmlFor="genericName">Generic Name</Label>
                <Input
                  id="genericName"
                  value={formData.genericName}
                  onChange={(e) => handleInputChange("genericName", e.target.value)}
                  placeholder="e.g., Paracetamol"
                />
              </div>

              <div>
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  value={formData.brandName}
                  onChange={(e) => handleInputChange("brandName", e.target.value)}
                  placeholder="e.g., Panadol"
                />
              </div>

              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => handleInputChange("manufacturer", e.target.value)}
                  placeholder="e.g., GSK"
                />
              </div>

              <div>
                <Label htmlFor="unitOfMeasurement">Unit of Measurement</Label>
                <Input
                  id="unitOfMeasurement"
                  value={formData.unitOfMeasurement}
                  onChange={(e) => handleInputChange("unitOfMeasurement", e.target.value)}
                  placeholder="e.g., tablets, bottles, boxes"
                />
              </div>

              <div>
                <Label htmlFor="packSize">Pack Size</Label>
                <Input
                  id="packSize"
                  type="number"
                  value={formData.packSize}
                  onChange={(e) => handleInputChange("packSize", e.target.value)}
                  placeholder="e.g., 100"
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Pricing</h3>
              
              <div>
                <Label htmlFor="purchasePrice">Purchase Price (£)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => handleInputChange("purchasePrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="salePrice">Sale Price (£)</Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => handleInputChange("salePrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="mrp">MRP (£)</Label>
                <Input
                  id="mrp"
                  type="number"
                  step="0.01"
                  value={formData.mrp}
                  onChange={(e) => handleInputChange("mrp", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => handleInputChange("taxRate", e.target.value)}
                  placeholder="20.00"
                />
              </div>
            </div>

            {/* Stock Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Stock Information</h3>
              
              <div>
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input
                  id="currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => handleInputChange("currentStock", e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="minimumStock">Minimum Stock</Label>
                <Input
                  id="minimumStock"
                  type="number"
                  value={formData.minimumStock}
                  onChange={(e) => handleInputChange("minimumStock", e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="maximumStock">Maximum Stock</Label>
                <Input
                  id="maximumStock"
                  type="number"
                  value={formData.maximumStock}
                  onChange={(e) => handleInputChange("maximumStock", e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => handleInputChange("reorderPoint", e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Additional Information</h3>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="prescriptionRequired"
                  checked={formData.prescriptionRequired}
                  onCheckedChange={(checked) => handleInputChange("prescriptionRequired", checked)}
                />
                <Label htmlFor="prescriptionRequired">Prescription Required</Label>
              </div>

              <div>
                <Label htmlFor="storageConditions">Storage Conditions</Label>
                <Textarea
                  id="storageConditions"
                  value={formData.storageConditions}
                  onChange={(e) => handleInputChange("storageConditions", e.target.value)}
                  placeholder="e.g., Store in cool, dry place"
                />
              </div>

              <div>
                <Label htmlFor="dosageInstructions">Dosage Instructions</Label>
                <Textarea
                  id="dosageInstructions"
                  value={formData.dosageInstructions}
                  onChange={(e) => handleInputChange("dosageInstructions", e.target.value)}
                  placeholder="e.g., 1-2 tablets every 4-6 hours"
                />
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={addItemMutation.isPending}
          >
            {addItemMutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        </DialogFooter>
        
        {/* Add Category Dialog */}
        <AddCategoryDialog 
          open={showCategoryDialog} 
          onOpenChange={setShowCategoryDialog} 
        />
      </DialogContent>
    </Dialog>

    {/* Success Modal - Outside main dialog to ensure it displays */}
    <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Item Added Successfully</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 mb-4">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Item Successfully Added to Inventory
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {successMessage}
          </p>
          <Button
            onClick={() => {
              setShowSuccessModal(false);
              setSuccessMessage("");
            }}
            className="mt-6 w-full"
            data-testid="button-close-item-success"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}