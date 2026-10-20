import { initMetaPixel, trackMeta, trackMetaPage } from "../../../shared/metaPixel";

initMetaPixel();
window.addEventListener("slovakgo:conversion", ((event: CustomEvent<{ event: string }>) => {
  const names: Record<string, string> = {
    demo_start: "DemoStart",
    demo_complete: "DemoComplete",
    registration_click: "RegistrationClick",
    placement_click: "PlacementClick",
  };
  const name = names[event.detail.event];
  if (name) trackMeta(name, { content_name: "SlovakGO landing" }, undefined, true);
}) as EventListener);
document.getElementById("language")?.addEventListener("change", () => trackMetaPage());
