import { AuthContext } from "@/lib/auth-provider";
import { useContext } from "react";

export const useAuth = () => useContext(AuthContext);
