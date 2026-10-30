export function getMutedShipmentBadgeClass(variant: string) {
  switch (variant) {
    case "success":
      return "!bg-[#32734A] !text-white !border-[#285F3C]"
    case "warning":
      return "!bg-[#9A6B2E] !text-white !border-[#805823]"
    case "info":
      return "!bg-[#315D82] !text-white !border-[#274C6A]"
    case "purple":
      return "!bg-[#477D98] !text-white !border-[#39677F]"
    case "danger":
      return "!bg-[#B04740] !text-white !border-[#963B35]"
    case "neutral":
      return "!bg-[#697078] !text-white !border-[#596068]"
    default:
      return "!bg-[#65736B] !text-white !border-[#536058]"
  }
}
