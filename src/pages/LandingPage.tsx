import { LandingHeader } from './landing/LandingHeader';
import { HeroSection } from './landing/HeroSection';
import { ProblemSection } from './landing/ProblemSection';
import { SolutionSection } from './landing/SolutionSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { FounderStorySection } from './landing/FounderStorySection';
import { PricingSection } from './landing/PricingSection';
import { SafetySection } from './landing/SafetySection';
import { HowItWorksSection } from './landing/HowItWorksSection';
import { TeamsSection } from './landing/TeamsSection';
import { CTASection } from './landing/CTASection';
import { LandingFooter } from './landing/LandingFooter';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToSignup: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToTerms: () => void;
  onNavigateToCommercial: () => void;
}

export function LandingPage({
  onNavigateToLogin,
  onNavigateToSignup,
  onNavigateToPrivacy,
  onNavigateToTerms,
  onNavigateToCommercial,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
      />
      <main>
        <HeroSection onNavigateToSignup={onNavigateToSignup} />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <FounderStorySection />
        <TeamsSection />
        <PricingSection onNavigateToSignup={onNavigateToSignup} />
        <SafetySection />
        <HowItWorksSection />
        <CTASection onNavigateToSignup={onNavigateToSignup} />
      </main>
      <LandingFooter
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToCommercial={onNavigateToCommercial}
      />
    </div>
  );
}
