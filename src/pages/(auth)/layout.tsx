// import {initializeFirebase, isTokenValid} from "@/lib/firebase-server";
import { useNavigate } from "react-router-dom";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navigate = useNavigate();

  // await initializeFirebase();

  // const isValid = await isTokenValid();

  // if (isValid) {
  if (false) {
    navigate("/dashboard");
  }

  return <>{children}</>;
}
