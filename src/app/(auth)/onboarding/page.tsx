import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireVerifiedUser } from "@/lib/session";

export default async function OnboardingPage() {
  await requireVerifiedUser();
  return <OnboardingWizard />;
}
