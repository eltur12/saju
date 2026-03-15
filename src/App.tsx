import { useState, useEffect } from "react";
import { getUser } from "./api/fortuneApi";
import Onboarding from "./pages/Onboarding";
import Main from "./pages/Main";

function App() {
  const [screen, setScreen] = useState<"onboarding" | "main">("onboarding");

  useEffect(() => {
    if (getUser()) setScreen("main");
  }, []);

  if (screen === "onboarding") {
    return <Onboarding onComplete={() => setScreen("main")} />;
  }
  return <Main onBack={() => setScreen("onboarding")} />;
}

export default App;
