// import {initializeFirebase, isTokenValid} from "@/lib/firebase-server";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // await initializeFirebase();

  // const isValid = await isTokenValid();

  // if (!isValid) {
  // if (false) {
  //     navigate("/login");
  // }

  return <>{children}</>;
}
