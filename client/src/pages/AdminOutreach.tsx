import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy route — Cal outreach lives at /admin/sales-agent */
export default function AdminOutreach() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/admin/sales-agent?step=review");
  }, [setLocation]);
  return null;
}
