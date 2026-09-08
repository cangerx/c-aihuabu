import type { ReactNode } from "react";
import { useEffect } from "react";

import { memberRequest, type AIChannel } from "@/services/api/membership";
import { filterModelsByCapability, modelOptionsFromChannels, useConfigStore, type ModelChannel } from "@/stores/use-config-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const updateConfig = useConfigStore((state) => state.updateConfig);

    useEffect(() => {
        void memberRequest<AIChannel[]>("/api/models").then((rows) => {
            const channels: ModelChannel[] = rows.map((row) => ({ id: row.id, name: row.name, baseUrl: row.baseUrl, apiKey: "", models: row.models }));
            const models = modelOptionsFromChannels(channels);
            updateConfig("channels", channels); updateConfig("models", models);
            updateConfig("imageModels", filterModelsByCapability(models, "image")); updateConfig("videoModels", filterModelsByCapability(models, "video"));
            updateConfig("textModels", filterModelsByCapability(models, "text")); updateConfig("audioModels", filterModelsByCapability(models, "audio"));
            updateConfig("aiProxyEnabled", true); updateConfig("apiKey", "");
        }).catch(() => undefined);
    }, [updateConfig]);

    return <>{children}</>;
}
