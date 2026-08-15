export type ArchitectureSpaceDefault = {
  zone: string;
  level: string;
  quantity: number;
  area: number;
};

export type ArchitectureProjectTemplate = {
  label: string;
  category: "residential" | "hospitality" | "commercial" | "education" | "healthcare" | "community" | "industrial" | "mixed" | "custom";
  spaces: string[];
  defaultSpaces: string[];
  directionFocus: string[];
  visualViews: string[];
  simpleCapacityLabel: string;
  simpleCapacityPlaceholder: string;
};

const templates: Record<string, ArchitectureProjectTemplate> = {
  Villa: {
    label: "Villa",
    category: "residential",
    spaces: ["Entrance", "Living", "Dining", "Kitchen", "Butler's Pantry", "Bedrooms", "Guest Suite", "Bathrooms", "Walk-in Robe", "Home Office", "Family Retreat", "Laundry", "Storage", "Garage", "Gym", "Cinema", "Pool", "Garden", "Outdoor Dining"],
    defaultSpaces: ["Living", "Dining", "Kitchen", "Bedrooms", "Bathrooms", "Garage", "Garden", "Outdoor Dining"],
    directionFocus: ["arrival sequence", "family privacy", "indoor-outdoor living", "landscape integration", "daylight", "premium residential character"],
    visualViews: ["Front Exterior", "Rear Exterior", "Street View", "Aerial View", "Living Room Interior", "Kitchen Interior", "Primary Suite Interior", "Outdoor Living", "Day View", "Night View"],
    simpleCapacityLabel: "Household size",
    simpleCapacityPlaceholder: "Example: family of 4, multigenerational family, frequent guests",
  },
  House: {
    label: "House",
    category: "residential",
    spaces: ["Entrance", "Living", "Dining", "Kitchen", "Pantry", "Bedrooms", "Guest Room", "Bathrooms", "Home Office", "Family Retreat", "Laundry", "Storage", "Garage", "Pool", "Garden", "Outdoor Dining"],
    defaultSpaces: ["Living", "Dining", "Kitchen", "Bedrooms", "Bathrooms", "Garage", "Garden"],
    directionFocus: ["family life", "privacy", "efficient planning", "natural light", "indoor-outdoor connection", "neighbourhood character"],
    visualViews: ["Front Exterior", "Rear Exterior", "Street View", "Aerial View", "Living Room Interior", "Kitchen Interior", "Primary Bedroom Interior", "Outdoor Living", "Day View", "Night View"],
    simpleCapacityLabel: "Household size",
    simpleCapacityPlaceholder: "Example: 2 adults and 2 children",
  },
  Apartment: {
    label: "Apartment",
    category: "residential",
    spaces: ["Entry", "Living", "Dining", "Kitchen", "Bedrooms", "Bathrooms", "Study", "Laundry", "Storage", "Balcony", "Winter Garden", "Shared Lounge", "Gym", "Parking"],
    defaultSpaces: ["Entry", "Living", "Dining", "Kitchen", "Bedrooms", "Bathrooms", "Laundry", "Balcony"],
    directionFocus: ["compact planning", "views", "daylight", "storage", "privacy", "shared amenity"],
    visualViews: ["Building Exterior", "Entry Lobby", "Living Interior", "Kitchen Interior", "Primary Bedroom Interior", "Balcony", "Aerial View", "Day View", "Night View"],
    simpleCapacityLabel: "Residents or units",
    simpleCapacityPlaceholder: "Example: one family apartment or 12 apartments",
  },
  Restaurant: {
    label: "Restaurant",
    category: "hospitality",
    spaces: ["Street Arrival", "Host Station", "Waiting Area", "Main Dining", "Private Dining", "Bar", "Outdoor Dining", "Commercial Kitchen", "Food Preparation", "Cold Storage", "Dry Storage", "Dishwashing", "Customer Bathrooms", "Staff Facilities", "Office", "Delivery Access", "Waste Area"],
    defaultSpaces: ["Street Arrival", "Host Station", "Main Dining", "Bar", "Commercial Kitchen", "Customer Bathrooms", "Staff Facilities", "Delivery Access"],
    directionFocus: ["street presence", "customer arrival", "seating experience", "brand expression", "kitchen workflow", "staff and guest circulation", "acoustics", "service efficiency"],
    visualViews: ["Street Façade", "Entrance Experience", "Main Dining Interior", "Bar Interior", "Private Dining Interior", "Outdoor Dining", "Commercial Kitchen Overview", "Aerial / Site View", "Day View", "Night View"],
    simpleCapacityLabel: "Target guests",
    simpleCapacityPlaceholder: "Example: 80 seated guests plus 20 outdoor seats",
  },
  "Café": {
    label: "Café",
    category: "hospitality",
    spaces: ["Street Arrival", "Queue", "Order Counter", "Coffee Bar", "Main Seating", "Window Seating", "Outdoor Seating", "Preparation Kitchen", "Display", "Customer Bathrooms", "Staff Area", "Storage", "Delivery Access", "Waste Area"],
    defaultSpaces: ["Street Arrival", "Order Counter", "Coffee Bar", "Main Seating", "Preparation Kitchen", "Customer Bathrooms", "Storage"],
    directionFocus: ["street visibility", "queue flow", "counter experience", "fast service", "atmosphere", "indoor-outdoor seating", "brand recognition"],
    visualViews: ["Street Façade", "Entrance and Queue", "Coffee Bar Interior", "Main Seating Interior", "Window Seating", "Outdoor Seating", "Preparation Area", "Day View", "Night View"],
    simpleCapacityLabel: "Target customers",
    simpleCapacityPlaceholder: "Example: 45 seats with fast takeaway service",
  },
  Retail: {
    label: "Retail",
    category: "commercial",
    spaces: ["Shopfront", "Customer Entry", "Feature Display", "Product Zones", "Point of Sale", "Changing Rooms", "Consultation Area", "Storage", "Staff Area", "Office", "Delivery Access", "Window Display"],
    defaultSpaces: ["Shopfront", "Customer Entry", "Feature Display", "Product Zones", "Point of Sale", "Storage", "Staff Area"],
    directionFocus: ["shopfront impact", "customer journey", "product visibility", "brand expression", "conversion", "stock flow", "flexible merchandising"],
    visualViews: ["Shopfront", "Customer Entry", "Feature Display Interior", "Main Retail Interior", "Point of Sale", "Changing Room", "Window Display", "Day View", "Night View"],
    simpleCapacityLabel: "Expected visitors",
    simpleCapacityPlaceholder: "Example: boutique retail with 25 customers at peak",
  },
  Office: {
    label: "Office",
    category: "commercial",
    spaces: ["Reception", "Waiting", "Open Workspace", "Private Offices", "Meeting Rooms", "Boardroom", "Focus Rooms", "Breakout Areas", "Staff Kitchen", "Wellness Room", "Bathrooms", "Storage", "Server Room", "Print Area", "Terrace"],
    defaultSpaces: ["Reception", "Open Workspace", "Meeting Rooms", "Boardroom", "Breakout Areas", "Staff Kitchen", "Bathrooms", "Storage"],
    directionFocus: ["workplace culture", "arrival", "collaboration", "focus", "acoustics", "flexibility", "staff wellbeing", "brand identity"],
    visualViews: ["Building Exterior", "Reception Interior", "Open Workspace", "Meeting Room", "Boardroom", "Breakout Area", "Staff Kitchen", "Terrace", "Aerial View"],
    simpleCapacityLabel: "Number of staff",
    simpleCapacityPlaceholder: "Example: 60 staff with hybrid working",
  },
  Hotel: {
    label: "Hotel",
    category: "hospitality",
    spaces: ["Arrival Court", "Lobby", "Reception", "Guest Rooms", "Suites", "Restaurant", "Bar", "Breakfast Area", "Pool", "Spa", "Gym", "Event Space", "Meeting Rooms", "Back of House", "Housekeeping", "Service Circulation", "Loading", "Administration"],
    defaultSpaces: ["Arrival Court", "Lobby", "Reception", "Guest Rooms", "Suites", "Restaurant", "Back of House", "Housekeeping", "Service Circulation"],
    directionFocus: ["guest arrival", "hospitality identity", "room efficiency", "guest and service separation", "amenity", "operations", "landscape", "destination experience"],
    visualViews: ["Hotel Exterior", "Arrival Experience", "Lobby Interior", "Guest Room Interior", "Suite Interior", "Restaurant Interior", "Pool and Amenity", "Aerial View", "Day View", "Night View"],
    simpleCapacityLabel: "Rooms and guests",
    simpleCapacityPlaceholder: "Example: 80 rooms with 160 guests",
  },
  Resort: {
    label: "Resort",
    category: "hospitality",
    spaces: ["Arrival", "Lobby", "Guest Villas", "Guest Rooms", "Restaurant", "Bar", "Pool", "Spa", "Gym", "Kids Club", "Event Lawn", "Beach / Landscape Access", "Back of House", "Housekeeping", "Service Routes", "Administration"],
    defaultSpaces: ["Arrival", "Lobby", "Guest Villas", "Restaurant", "Pool", "Spa", "Back of House", "Housekeeping", "Service Routes"],
    directionFocus: ["destination identity", "landscape immersion", "guest privacy", "amenity", "service logistics", "climate response", "arrival sequence", "indoor-outdoor experience"],
    visualViews: ["Resort Arrival", "Aerial Masterplan", "Lobby Interior", "Guest Villa Exterior", "Guest Villa Interior", "Restaurant Interior", "Pool and Landscape", "Spa Interior", "Day View", "Night View"],
    simpleCapacityLabel: "Rooms, villas or guests",
    simpleCapacityPlaceholder: "Example: 40 villas and 120 guests",
  },
  Education: {
    label: "Education",
    category: "education",
    spaces: ["Arrival", "Reception", "Classrooms", "Lecture Rooms", "Studios", "Laboratories", "Library", "Administration", "Staff Rooms", "Student Commons", "Cafeteria", "Auditorium", "Sports", "Outdoor Learning", "Bathrooms", "Storage", "Service Areas"],
    defaultSpaces: ["Arrival", "Reception", "Classrooms", "Library", "Administration", "Student Commons", "Bathrooms", "Outdoor Learning"],
    directionFocus: ["learning communities", "wayfinding", "flexibility", "daylight", "acoustics", "accessibility", "student wellbeing", "safe circulation"],
    visualViews: ["Campus Exterior", "Arrival", "Learning Commons", "Classroom Interior", "Studio / Lab Interior", "Library", "Student Commons", "Outdoor Learning", "Aerial View"],
    simpleCapacityLabel: "Students and staff",
    simpleCapacityPlaceholder: "Example: 600 students and 75 staff",
  },
  Healthcare: {
    label: "Healthcare",
    category: "healthcare",
    spaces: ["Arrival", "Reception", "Waiting", "Emergency Department", "Consult Rooms", "Treatment Rooms", "Procedure Rooms", "Operating Theatres", "ICU", "Patient Rooms", "Inpatient Wards", "Nurse Stations", "Diagnostics", "Pharmacy", "Staff Areas", "Administration", "Clean Utility", "Dirty Utility", "Storage", "Bathrooms", "Service Access"],
    defaultSpaces: ["Arrival", "Reception", "Waiting", "Consult Rooms", "Treatment Rooms", "Patient Rooms", "Diagnostics", "Pharmacy", "Staff Areas", "Administration", "Clean Utility", "Dirty Utility", "Storage", "Bathrooms", "Service Access"],
    directionFocus: ["patient dignity", "requested bed or patient capacity", "clear wayfinding", "clinical workflow", "inpatient and outpatient separation", "privacy", "daylight", "staff efficiency", "infection-control awareness", "service logistics", "calm atmosphere"],
    visualViews: ["Building Exterior", "Arrival", "Reception and Waiting", "Consult Room", "Treatment Room", "Patient Room", "Inpatient Ward", "Staff Area", "Healing Garden", "Aerial View"],
    simpleCapacityLabel: "Beds / patients and staff",
    simpleCapacityPlaceholder: "Example: 100 beds and 150 staff, or 120 patients per day and 35 staff",
  },
  Community: {
    label: "Community",
    category: "community",
    spaces: ["Arrival", "Reception", "Multipurpose Hall", "Meeting Rooms", "Workshop Rooms", "Community Kitchen", "Youth Area", "Senior Area", "Administration", "Storage", "Bathrooms", "Outdoor Gathering", "Service Access"],
    defaultSpaces: ["Arrival", "Reception", "Multipurpose Hall", "Meeting Rooms", "Community Kitchen", "Administration", "Bathrooms", "Outdoor Gathering"],
    directionFocus: ["welcoming identity", "inclusion", "flexibility", "community visibility", "safe access", "durability", "multi-generational use"],
    visualViews: ["Community Building Exterior", "Arrival", "Multipurpose Hall", "Workshop Interior", "Community Kitchen", "Meeting Room", "Outdoor Gathering", "Aerial View", "Night View"],
    simpleCapacityLabel: "Peak users",
    simpleCapacityPlaceholder: "Example: 250 people during events",
  },
  "Warehouse / Industrial": {
    label: "Warehouse / Industrial",
    category: "industrial",
    spaces: ["Site Entry", "Security", "Loading Docks", "Warehouse Floor", "Production Area", "Cold Storage", "Dispatch", "Office", "Staff Amenities", "Plant Rooms", "Waste Area", "Truck Circulation", "Visitor Parking", "Staff Parking"],
    defaultSpaces: ["Site Entry", "Loading Docks", "Warehouse Floor", "Dispatch", "Office", "Staff Amenities", "Truck Circulation"],
    directionFocus: ["logistics", "truck movement", "operational efficiency", "clear span", "durability", "staff safety", "energy performance", "corporate identity"],
    visualViews: ["Main Exterior", "Site Entry", "Loading Dock", "Warehouse Interior", "Production Interior", "Office Interior", "Aerial Logistics View", "Day View", "Night View"],
    simpleCapacityLabel: "Operations capacity",
    simpleCapacityPlaceholder: "Example: 8 loading bays and 120 staff",
  },
  "Mixed Use": {
    label: "Mixed Use",
    category: "mixed",
    spaces: ["Public Arrival", "Residential Lobby", "Commercial Lobby", "Retail", "Office", "Apartments", "Shared Amenity", "Parking", "Loading", "Service Core", "Public Realm", "Landscape", "Bathrooms", "Back of House"],
    defaultSpaces: ["Public Arrival", "Residential Lobby", "Commercial Lobby", "Retail", "Apartments", "Parking", "Loading", "Public Realm"],
    directionFocus: ["public realm", "separate access", "mixed-use identity", "vertical circulation", "servicing", "privacy", "street activation", "amenity"],
    visualViews: ["Main Exterior", "Public Realm", "Residential Lobby", "Commercial Lobby", "Retail Interior", "Shared Amenity", "Aerial View", "Day View", "Night View"],
    simpleCapacityLabel: "Development mix",
    simpleCapacityPlaceholder: "Example: 30 apartments, 2 retail units and 1 office floor",
  },
  Other: {
    label: "Other / Custom",
    category: "custom",
    spaces: ["Arrival", "Primary Activity", "Secondary Activity", "Public Area", "Private Area", "Service Area", "Staff Area", "Storage", "Bathrooms", "Outdoor Area", "Parking", "Loading"],
    defaultSpaces: ["Arrival", "Primary Activity", "Public Area", "Service Area", "Bathrooms"],
    directionFocus: ["project purpose", "users", "arrival", "circulation", "operations", "identity", "site response"],
    visualViews: ["Main Exterior", "Arrival", "Primary Interior", "Secondary Interior", "Aerial View", "Day View", "Night View"],
    simpleCapacityLabel: "Expected users",
    simpleCapacityPlaceholder: "Describe how many people will use the project",
  },
};

const spaceDefaults: Record<string, ArchitectureSpaceDefault> = {
  Entrance: { zone: "Public", level: "Ground", quantity: 1, area: 12 },
  Entry: { zone: "Public", level: "Ground", quantity: 1, area: 8 },
  "Street Arrival": { zone: "Public", level: "Ground", quantity: 1, area: 15 },
  Arrival: { zone: "Public", level: "Ground", quantity: 1, area: 18 },
  "Arrival Court": { zone: "Outdoor", level: "Ground", quantity: 1, area: 80 },
  Reception: { zone: "Public", level: "Ground", quantity: 1, area: 24 },
  "Host Station": { zone: "Public", level: "Ground", quantity: 1, area: 8 },
  "Waiting Area": { zone: "Public", level: "Ground", quantity: 1, area: 18 },
  Waiting: { zone: "Public", level: "Ground", quantity: 1, area: 30 },
  Living: { zone: "Public", level: "Ground", quantity: 1, area: 34 },
  Dining: { zone: "Public", level: "Ground", quantity: 1, area: 20 },
  Kitchen: { zone: "Public / Service", level: "Ground", quantity: 1, area: 22 },
  Pantry: { zone: "Service", level: "Ground", quantity: 1, area: 8 },
  "Butler's Pantry": { zone: "Service", level: "Ground", quantity: 1, area: 12 },
  Bedrooms: { zone: "Private", level: "Upper / Ground", quantity: 3, area: 16 },
  "Guest Room": { zone: "Private", level: "Ground", quantity: 1, area: 18 },
  "Guest Suite": { zone: "Private", level: "Ground", quantity: 1, area: 24 },
  Bathrooms: { zone: "Private / Service", level: "All levels", quantity: 3, area: 6 },
  "Home Office": { zone: "Flexible", level: "Ground / Upper", quantity: 1, area: 14 },
  Garage: { zone: "Service", level: "Ground / Basement", quantity: 1, area: 40 },
  Pool: { zone: "Outdoor", level: "Ground", quantity: 1, area: 36 },
  Garden: { zone: "Outdoor", level: "Ground", quantity: 1, area: 90 },
  "Outdoor Dining": { zone: "Outdoor", level: "Ground", quantity: 1, area: 28 },
  "Main Dining": { zone: "Public", level: "Ground", quantity: 1, area: 120 },
  "Private Dining": { zone: "Private / Public", level: "Ground", quantity: 1, area: 30 },
  Bar: { zone: "Public / Service", level: "Ground", quantity: 1, area: 26 },
  "Commercial Kitchen": { zone: "Service", level: "Ground", quantity: 1, area: 55 },
  "Food Preparation": { zone: "Service", level: "Ground", quantity: 1, area: 24 },
  "Cold Storage": { zone: "Service", level: "Ground", quantity: 1, area: 12 },
  "Dry Storage": { zone: "Service", level: "Ground", quantity: 1, area: 14 },
  Dishwashing: { zone: "Service", level: "Ground", quantity: 1, area: 14 },
  "Customer Bathrooms": { zone: "Service", level: "Ground", quantity: 1, area: 24 },
  "Staff Facilities": { zone: "Service", level: "Ground", quantity: 1, area: 18 },
  "Delivery Access": { zone: "Service", level: "Ground", quantity: 1, area: 24 },
  "Open Workspace": { zone: "Public", level: "Typical floor", quantity: 1, area: 180 },
  "Private Offices": { zone: "Private", level: "Typical floor", quantity: 4, area: 14 },
  "Meeting Rooms": { zone: "Flexible", level: "Typical floor", quantity: 3, area: 18 },
  Boardroom: { zone: "Private", level: "Typical floor", quantity: 1, area: 32 },
  "Breakout Areas": { zone: "Public", level: "Typical floor", quantity: 2, area: 30 },
  "Staff Kitchen": { zone: "Service", level: "Typical floor", quantity: 1, area: 24 },
  Lobby: { zone: "Public", level: "Ground", quantity: 1, area: 100 },
  "Guest Rooms": { zone: "Private", level: "Upper levels", quantity: 40, area: 28 },
  Suites: { zone: "Private", level: "Upper levels", quantity: 8, area: 48 },
  "Back of House": { zone: "Service", level: "Ground / Basement", quantity: 1, area: 160 },
  Housekeeping: { zone: "Service", level: "All guest levels", quantity: 3, area: 20 },
  "Service Circulation": { zone: "Service", level: "All levels", quantity: 1, area: 80 },
  Classrooms: { zone: "Public", level: "All levels", quantity: 12, area: 55 },
  Library: { zone: "Public", level: "Ground / Upper", quantity: 1, area: 220 },
  "Student Commons": { zone: "Public", level: "Ground", quantity: 1, area: 180 },
  "Consult Rooms": { zone: "Private", level: "Ground / Upper", quantity: 8, area: 16 },
  "Treatment Rooms": { zone: "Private", level: "Ground / Upper", quantity: 4, area: 22 },
  "Procedure Rooms": { zone: "Clinical", level: "Ground / Upper", quantity: 4, area: 24 },
  "Emergency Department": { zone: "Clinical / Public", level: "Ground", quantity: 1, area: 320 },
  "Operating Theatres": { zone: "Clinical", level: "Upper / Ground", quantity: 3, area: 55 },
  ICU: { zone: "Clinical / Private", level: "Upper levels", quantity: 1, area: 240 },
  "Patient Rooms": { zone: "Private / Clinical", level: "Upper levels", quantity: 20, area: 20 },
  "Inpatient Wards": { zone: "Private / Clinical", level: "Upper levels", quantity: 4, area: 280 },
  "Nurse Stations": { zone: "Clinical / Staff", level: "All inpatient levels", quantity: 2, area: 24 },
  Diagnostics: { zone: "Clinical", level: "Ground / Upper", quantity: 1, area: 180 },
  Pharmacy: { zone: "Clinical / Public", level: "Ground", quantity: 1, area: 70 },
  "Staff Areas": { zone: "Staff", level: "All levels", quantity: 2, area: 50 },
  Administration: { zone: "Staff / Private", level: "Ground / Upper", quantity: 1, area: 120 },
  "Clean Utility": { zone: "Clinical / Service", level: "All clinical levels", quantity: 2, area: 14 },
  "Dirty Utility": { zone: "Clinical / Service", level: "All clinical levels", quantity: 2, area: 14 },
  "Service Access": { zone: "Service", level: "Ground", quantity: 1, area: 60 },
  "Multipurpose Hall": { zone: "Public", level: "Ground", quantity: 1, area: 240 },
  "Warehouse Floor": { zone: "Service", level: "Ground", quantity: 1, area: 1200 },
  "Loading Docks": { zone: "Service", level: "Ground", quantity: 4, area: 45 },
  "Truck Circulation": { zone: "Outdoor", level: "Ground", quantity: 1, area: 800 },
};

export const ARCHITECTURE_PROJECT_TYPES = Object.keys(templates);

export function getArchitectureProjectTemplate(projectType: string | null | undefined) {
  return templates[projectType || ""] || templates.Other;
}

export function getArchitectureSpaceDefault(space: string): ArchitectureSpaceDefault {
  return spaceDefaults[space] || { zone: "Flexible", level: "Ground", quantity: 1, area: 18 };
}

export function getArchitectureVisualViews(projectType: string | null | undefined) {
  return getArchitectureProjectTemplate(projectType).visualViews;
}

const materialKeywordsByCategory: Record<ArchitectureProjectTemplate["category"], string[]> = {
  residential: ["stone", "timber", "wood", "render", "concrete", "glass", "metal", "flooring", "roof", "landscape"],
  hospitality: ["stone", "tile", "terrazzo", "timber", "wood", "metal", "glass", "acoustic", "upholstery", "counter", "commercial", "flooring"],
  commercial: ["glass", "metal", "concrete", "carpet", "acoustic", "timber", "vinyl", "flooring", "ceiling", "partition"],
  education: ["durable", "acoustic", "linoleum", "vinyl", "brick", "concrete", "timber", "rubber", "flooring", "shade"],
  healthcare: ["hygienic", "vinyl", "rubber", "solid surface", "acoustic", "washable", "antimicrobial", "flooring", "ceiling", "wall"],
  community: ["durable", "brick", "timber", "acoustic", "concrete", "vinyl", "tile", "flooring", "shade", "landscape"],
  industrial: ["steel", "concrete", "metal", "insulated", "epoxy", "roof", "cladding", "industrial", "flooring", "durable"],
  mixed: ["stone", "glass", "metal", "concrete", "timber", "tile", "carpet", "flooring", "public realm", "landscape"],
  custom: ["stone", "timber", "metal", "glass", "concrete", "tile", "flooring", "wall", "roof", "landscape"],
};

const paintApplicationsByCategory: Record<ArchitectureProjectTemplate["category"], string[]> = {
  residential: ["Main interior walls", "Feature walls", "Ceilings", "Exterior walls", "Façade render", "Doors and trims", "Joinery", "Metal frames", "Outdoor structures", "Custom application"],
  hospitality: ["Dining walls", "Feature walls", "Ceilings", "Street façade", "Bar and counter joinery", "Kitchen back-of-house", "Bathrooms", "Signage and branding", "Outdoor dining", "Custom application"],
  commercial: ["Reception walls", "Workspace walls", "Meeting rooms", "Ceilings", "Façade", "Joinery", "Doors and trims", "Wayfinding", "Metalwork", "Custom application"],
  education: ["Classroom walls", "Corridors", "Learning commons", "Ceilings", "Exterior walls", "Doors", "Wayfinding", "Protective wall coating", "Outdoor learning", "Custom application"],
  healthcare: ["Patient-facing walls", "Clinical rooms", "Corridors", "Ceilings", "Exterior walls", "Doors and trims", "Wayfinding", "Back-of-house", "Wet areas", "Custom application"],
  community: ["Multipurpose spaces", "Meeting rooms", "Corridors", "Ceilings", "Exterior walls", "Doors and trims", "Wayfinding", "Outdoor structures", "Feature walls", "Custom application"],
  industrial: ["Office walls", "Warehouse walls", "Safety zones", "Floors", "External cladding", "Doors", "Steelwork", "Wayfinding", "Loading areas", "Custom application"],
  mixed: ["Residential interiors", "Commercial interiors", "Retail areas", "Lobbies", "Ceilings", "Façade", "Joinery", "Wayfinding", "Public realm elements", "Custom application"],
  custom: ["Interior walls", "Feature walls", "Ceilings", "Exterior walls", "Façade", "Joinery", "Doors and trims", "Metalwork", "Signage", "Custom application"],
};

export function getArchitectureMaterialKeywords(projectType: string | null | undefined) {
  return materialKeywordsByCategory[getArchitectureProjectTemplate(projectType).category];
}

export function getArchitecturePaintApplications(projectType: string | null | undefined) {
  return paintApplicationsByCategory[getArchitectureProjectTemplate(projectType).category];
}

