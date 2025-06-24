import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import SignIn from "./pages/(auth)/sign-in/page";
import SignUp from "./pages/(auth)/sign-up/page";
import Join from "./pages/(auth)/join/page";
import AuthCallback from "./pages/(auth)/auth/callback/page";

function App() {
  return (
    <Router>
      <Routes>
        {/* AUTHENTICATION */}
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/join" element={<Join />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
