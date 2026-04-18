// state/index.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BooleanQuestion {
  question: string;
  value: boolean | null;
}

export interface PhotoState {
  id: string;
  uri: string;
  s3Key: string;
  status: "uploading" | "success" | "error" | "deleting";
  error?: string;
}

interface VifFormState {
  selectedVehicleId: string;
  selectedVehicleReg: string;
  selectedVehicleVin: string;
  odometerValue: string;
  booleanQuestions: BooleanQuestion[];
  photos: PhotoState[];
}

interface UploadProgressState {
  isUploading: boolean;
  currentImage: number;
  totalImages: number;
}

interface InitialStateTypes {
  vifForm: VifFormState;
  uploadProgress: UploadProgressState;
  responseModal: { visible: boolean; successful: boolean; message: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const BOOLEAN_QUESTIONS: BooleanQuestion[] = [
  { question: "Are the engine oil and Coolant Level Acceptable?", value: null },
  { question: "Is there a full tank of Fuel prior to start?", value: null },
  {
    question: "Are the Seatbelts, Doors and Mirrors Functioning Correctly?",
    value: null,
  },
  { question: "Is the handbrake Tested and Functional?", value: null },
  {
    question: "Are all the Tyres wear, Tread, and Pressure Acceptable?",
    value: null,
  },
  {
    question:
      "Is there a Spare tyre, jack, Spanner on the vehicle and in good condition?",
    value: null,
  },
  {
    question:
      "Is there a valid number plate on the Front and Back of the vehicle?",
    value: null,
  },
  {
    question: "Is the License Disc Clearly Visible in the windscreen?",
    value: null,
  },
  {
    question: "Is there any signs of leaks under the vehicle prior to start?",
    value: null,
  },
  {
    question:
      "Are the headlights, Taillights, Fog Lights, indicators and hazards functioning correctly?",
    value: null,
  },
  {
    question: "Are the defrosters, heaters and air conditioners functional?",
    value: null,
  },
  {
    question:
      "Is the Emergency Kit within the Vehicle (First Aid Kit, Fire extinguisher, Warning Triangle)?",
    value: null,
  },
  { question: "Is the car interior and Exterior Clean?", value: null },
  {
    question: "Are there any warning Lights present on the Dash at start up?",
    value: null,
  },
  { question: "Are the Windscreen Wipers in working condition?", value: null },
  { question: "Is the Service book within the vehicle?", value: null },
  {
    question:
      "Is there Reflectors, Buggy Whip, Strobe Light and Stop Blocks within the Vehicle?",
    value: null,
  },
];

const EMPTY_VIF_FORM: VifFormState = {
  selectedVehicleId: "",
  selectedVehicleReg: "",
  selectedVehicleVin: "",
  odometerValue: "",
  booleanQuestions: BOOLEAN_QUESTIONS,
  photos: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

const initialState: InitialStateTypes = {
  vifForm: EMPTY_VIF_FORM,
  uploadProgress: { isUploading: false, currentImage: 0, totalImages: 0 },
  responseModal: { visible: false, successful: false, message: "" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

export const globalSlice = createSlice({
  name: "global",
  initialState,

  reducers: {
    /* ── VIF form ─────────────────────────────────────────────────────────── */

    setSelectedVehicle: (
      state,
      action: PayloadAction<{ id: string; reg: string; vin: string }>,
    ) => {
      state.vifForm.selectedVehicleId = action.payload.id;
      state.vifForm.selectedVehicleReg = action.payload.reg;
      state.vifForm.selectedVehicleVin = action.payload.vin;
      state.vifForm.photos = []; // clear photos when vehicle changes
    },

    setOdometer: (state, action: PayloadAction<string>) => {
      state.vifForm.odometerValue = action.payload;
    },

    setBooleanQuestions: (state, action: PayloadAction<BooleanQuestion[]>) => {
      state.vifForm.booleanQuestions = action.payload;
    },

    setBooleanAnswer: (
      state,
      action: PayloadAction<{ index: number; value: boolean }>,
    ) => {
      state.vifForm.booleanQuestions[action.payload.index].value =
        action.payload.value;
    },

    setPhotos: (state, action: PayloadAction<PhotoState[]>) => {
      state.vifForm.photos = action.payload;
    },

    addPhoto: (state, action: PayloadAction<PhotoState>) => {
      state.vifForm.photos.push(action.payload);
    },

    updatePhotoStatus: (
      state,
      action: PayloadAction<{
        id: string;
        status: PhotoState["status"];
        s3Key?: string;
        error?: string;
      }>,
    ) => {
      const photo = state.vifForm.photos.find(
        (p) => p.id === action.payload.id,
      );
      if (photo) {
        photo.status = action.payload.status;
        if (action.payload.s3Key) photo.s3Key = action.payload.s3Key;
        if (action.payload.error) photo.error = action.payload.error;
      }
    },

    removePhoto: (state, action: PayloadAction<string>) => {
      state.vifForm.photos = state.vifForm.photos.filter(
        (p) => p.id !== action.payload,
      );
    },

    clearAllPhotos: (state) => {
      state.vifForm.photos = [];
    },

    resetVifForm: (state) => {
      state.vifForm = EMPTY_VIF_FORM;
    },

    /* ── Upload progress ──────────────────────────────────────────────────── */

    setUploadProgress: (state, action: PayloadAction<UploadProgressState>) => {
      state.uploadProgress = action.payload;
    },

    incrementUploadProgress: (state) => {
      state.uploadProgress.currentImage += 1;
    },

    resetUploadProgress: (state) => {
      state.uploadProgress = {
        isUploading: false,
        currentImage: 0,
        totalImages: 0,
      };
    },

    /* Response Modal Reducer */
    showResponseModal: (
      state,
      action: PayloadAction<{ successful: boolean; message: string }>,
    ) => {
      state.responseModal = { visible: true, ...action.payload };
    },
    hideResponseModal: (state) => {
      state.responseModal.visible = false;
    },
  },
});

export const {
  setSelectedVehicle,
  setOdometer,
  setBooleanQuestions,
  setBooleanAnswer,
  setPhotos,
  addPhoto,
  updatePhotoStatus,
  removePhoto,
  clearAllPhotos,
  resetVifForm,
  setUploadProgress,
  incrementUploadProgress,
  resetUploadProgress,
  showResponseModal,
  hideResponseModal,
} = globalSlice.actions;

export default globalSlice.reducer;
