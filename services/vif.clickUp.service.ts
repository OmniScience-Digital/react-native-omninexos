import { normalize } from "@/lib/utils";
import * as constants from "@/src/constants";

export const Vif_clickUpService = {
  async createTask(payload: {
    vehicleId: string;
    inspectionNo: string;
    vehicleReg: string;
    vehicleVin: string;
    odometer: number;
    username: string | null;
    serviceRequired: string;
    reviewRequired: string;
    tyreRotationRequired: string;
    inspectionResults: any[];
    timestamp: string;
    s3PhotoKeys: string[];
    photoCount: number;
  }) {
    // Format inspection questions
    const questionLines =
      payload.inspectionResults?.length > 0
        ? payload.inspectionResults
            .map(
              (item, index) =>
                `${index + 1}. ${item.question}\nAnswer: ${
                  item.answer === "true" ? "Yes" : "No"
                }`,
            )
            .join("\n\n")
        : "No inspection results provided.";

    const taskBody = {
      name: `Vehicle Inspection - ${payload.vehicleReg} ${payload.timestamp}`,
      description: `Inspection No: ${payload.inspectionNo}
Vehicle Vin: ${payload.vehicleVin}
Vehicle Reg: ${payload.vehicleReg}
Vehicle ID: ${payload.vehicleId}
Odometer: ${payload.odometer}
Username: ${payload.username}

Inspection Results:

${questionLines}`,
      custom_fields: [
        {
          id: constants.USERNAME_FIELD_ID,
          value: normalize(payload.username || ""),
        },
        {
          id: constants.SERVICE_FIELD_ID,
          value: normalize(payload.serviceRequired),
        },
        {
          id: constants.TYRE_FIELD_ID,
          value: normalize(payload.tyreRotationRequired),
        },
        {
          id: constants.REVIEW_FIELD_ID,
          value: normalize(payload.reviewRequired),
        },
      ],
      status: "to do",
    };

    // CHANGE THIS LINE ONLY - Call ClickUp directly, not your broken backend
    const response = await fetch(
      `https://api.clickup.com/api/v2/list/${constants.VIF_LIST_ID}/task`,
      {
        method: "POST",
        headers: {
          Authorization: constants.API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskBody),
      },
    );

    if (!response.ok) throw new Error(`ClickUp returned ${response.status}`);

    const data = await response.json();

    if (!data || !data.id) throw new Error("Failed to create ClickUp task");

    return {
      success: true,
      message: "Task created successfully",
      taskId: data.id,
      data,
    };
  },
};

export const Vif_clickUpTasksService = {
  // --- Create Vehicle Task (Service / Rotation) ---
  async createInspectionTask(payload: {
    issuetype: "service" | "rotation";
    title: string;
    servicePlanStatus?: string;
    servicePlan?: string;
    lastServiceDate?: string;
    lastServicekm?: number;
    lastRotationdate?: string;
    lastRotationkm?: number;
    vehicleReg: string;
    odometer: number;
    username: string | null;
    serviceRequired?: boolean | string;
    reviewRequired?: boolean | string;
    tyreRotationRequired?: boolean | string;
    vehicleVin: string;
  }) {
    try {
      // Build description based on type
      let description = "";

      if (payload.issuetype === "service") {
        description = `Vehicle Reg: ${payload.vehicleReg}
                Vehicle Vin: ${payload.vehicleVin}
                Service Plan Status: ${payload.servicePlanStatus}
                Service Plan: ${payload.servicePlan}
                Previous Service km: ${payload.lastServicekm}
                Previous Service Date: ${payload.lastServiceDate}
                Current Driver: ${payload.username}
                Current Km: ${payload.odometer}`;
      } else if (payload.issuetype === "rotation") {
        description = `Vehicle Reg: ${payload.vehicleReg}
                Vehicle Vin: ${payload.vehicleVin}
                Service Plan Status: ${payload.servicePlanStatus}
                Service Plan: ${payload.servicePlan}
                Previous Rotation km: ${payload.lastRotationkm}
                Previous Rotation Date: ${payload.lastRotationdate}
                Current Driver: ${payload.username}
                Current Km: ${payload.odometer}`;
      }

      const taskBody = {
        name: payload.title,
        description,
        custom_fields: [
          {
            id: constants.USERNAME_FIELD_ID,
            value: normalize(payload.username || ""),
          },
          {
            id: constants.SERVICE_FIELD_ID,
            value: normalize(String(payload.serviceRequired)),
          },
          {
            id: constants.TYRE_FIELD_ID,
            value: normalize(String(payload.tyreRotationRequired)),
          },
          {
            id: constants.REVIEW_FIELD_ID,
            value: normalize(String(payload.reviewRequired)),
          },
        ],
        status: "to do",
      };

      // CALL CLICKUP DIRECTLY - NOT YOUR BACKEND
      const createTaskResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${constants.VIF_LIST_ID}/task`,
        {
          method: "POST",
          headers: {
            Authorization: constants.API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskBody),
        },
      );

      const taskData = await createTaskResponse.json();

      if (!taskData.id) {
        return {
          success: false,
          error: "Failed to create ClickUp task",
          details: taskData,
        };
      }

      return {
        success: true,
        taskId: taskData.id,
        message: "ClickUp task created successfully",
        data: taskData,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // --- Update Task Description (append odometer) ---
  async updateDescription(payload: {
    taskId: string | number | null;
    odometer: number;
  }) {
    if (!payload.taskId)
      return { success: false, error: "taskId is null or undefined" };

    try {
      // GET CURRENT TASK - DIRECT CLICKUP CALL
      const getTaskResponse = await fetch(
        `https://api.clickup.com/api/v2/task/${payload.taskId}`,
        {
          method: "GET",
          headers: {
            Authorization: constants.API_TOKEN,
          },
        },
      );

      const existingTask = await getTaskResponse.json();
      const currentName = existingTask.name || "";
      const currentDescription = existingTask.description || "";
      const updatedDescription = `${currentDescription}\nCurrent Km: ${payload.odometer}`;

      // UPDATE TASK - DIRECT CLICKUP CALL
      await fetch(`https://api.clickup.com/api/v2/task/${payload.taskId}`, {
        method: "PUT",
        headers: {
          Authorization: constants.API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: currentName,
          description: updatedDescription,
        }),
      });

      return {
        success: true,
        message: "Task description updated successfully",
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export async function uploadPhoto({
  photo,
  taskId,
}: {
  photo: { uri: string; name?: string; type?: string };
  taskId: string;
}) {
  try {
    const fileName = photo.name || `photo_${Date.now()}.jpg`;
    const mimeType = photo.type || "image/jpeg";

    const formData = new FormData();

    //  React Native FormData syntax — do NOT use fetch() + blob() here.
    // Passing the object directly tells RN's native networking layer to
    // read the file from the URI and include the correct filename + MIME type.
    formData.append("attachment", {
      uri: photo.uri,
      name: fileName,
      type: mimeType,
    } as any);

    const uploadResponse = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}/attachment`,
      {
        method: "POST",
        headers: {
          Authorization: constants.API_TOKEN,
          // ❌ Do NOT set Content-Type manually — RN sets it with the correct
          // multipart boundary automatically when body is FormData.
        },
        body: formData,
      },
    );

    const result = await uploadResponse.json();

    if (!result?.id) {
      return { success: false, error: "ClickUp upload failed", data: result };
    }

    return {
      success: true,
      message: `Uploaded ${fileName} successfully`,
      data: result,
    };
  } catch (error: any) {
    console.error("Upload to ClickUp failed:", error);
    return { success: false, error: error.message };
  }
}
