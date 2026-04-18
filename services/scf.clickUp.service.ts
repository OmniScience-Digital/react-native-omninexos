// src/services/scf.clickUpService.ts
import * as constants from "@/src/constants";

export const SCF_clickUpService = {
  async createTask(username: string | null, result: any) {
    const response = await fetch(`${constants.securebaseUrltest}/clickuppost`, {
      method: "POST" as const,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, result }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const externalResponse = await response.json();

    if (!externalResponse || Object.keys(externalResponse).length === 0) {
      throw new Error("Backend returned no data");
    }

    return {
      success: true,
      message: "Task created successfully",
      data: externalResponse,
    };
  },
};
