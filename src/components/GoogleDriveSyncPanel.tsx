import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  UploadCloud, 
  DownloadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  LogOut, 
  FileJson, 
  FileSpreadsheet, 
  Trash2, 
  Database,
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  connectGoogleDrive, 
  disconnectGoogleDrive, 
  getGoogleAccessToken, 
  getGoogleUser, 
  uploadToDriveMultipart, 
  listDriveBackups, 
  downloadDriveFile, 
  deleteDriveFile 
} from "../lib/driveSync.ts";

interface GoogleDriveSyncPanelProps {
  bikesList: any[];
  sparesList: any[];
  logsList: any[];
  requestsList: any[];
  user: any; // Authenticated user
  onRefreshData: () => Promise<void>;
}

export default function GoogleDriveSyncPanel({
  bikesList,
  sparesList,
  logsList,
  requestsList,
  user,
  onRefreshData
}: GoogleDriveSyncPanelProps) {
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: ""
  });
  const [autoSync, setAutoSync] = useState(() => {
    try {
      return localStorage.getItem("eff_drive_autosync") === "true";
    } catch { return false; }
  });

  // Track autoSync state
  useEffect(() => {
    localStorage.setItem("eff_drive_autosync", String(autoSync));
  }, [autoSync]);

  // Check connection status on mount
  useEffect(() => {
    const token = getGoogleAccessToken();
    const gUser = getGoogleUser();
    if (token && gUser) {
      setAccessToken(token);
      setGoogleUser(gUser);
      loadBackupsList(token);
    }
  }, []);

  const loadBackupsList = async (token: string) => {
    try {
      const files = await listDriveBackups(token);
      setBackups(files);
    } catch (err: any) {
      console.error("Error listing backups:", err);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setSyncStatus({ type: "idle", message: "" });
    try {
      const conn = await connectGoogleDrive();
      if (conn) {
        setGoogleUser(conn.user);
        setAccessToken(conn.accessToken);
        setSyncStatus({ type: "success", message: `Connected successfully to Google account: ${conn.user.email}` });
        await loadBackupsList(conn.accessToken);
      }
    } catch (err: any) {
      setSyncStatus({ type: "error", message: err.message || "Failed to connect to Google Drive." });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectGoogleDrive();
      setGoogleUser(null);
      setAccessToken(null);
      setBackups([]);
      setSyncStatus({ type: "idle", message: "Disconnected from Google Drive." });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Create JSON database backup blob
  const getJsonBackupBlob = () => {
    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      bikes: bikesList,
      spares: sparesList,
      logs: logsList,
      requests: requestsList,
      exportedBy: googleUser?.email || "Unknown MechLog Admin"
    };
    return new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
  };

  // Create Excel workbook Blob for Drive backup
  const getExcelBackupBlob = () => {
    const bikesData = bikesList.map(b => ({
      "Bike ID": b.id,
      "Registration No": b.regNo,
      "Model/Make": b.model,
      "Province": b.province,
      "District": b.district,
      "Assigned Officer": b.officer,
      "Date Registered": b.dateAdded
    }));
    
    const logsData = logsList.map(l => ({
      "Log ID": l.id,
      "Date": l.date,
      "Bike Registration": l.bikeReg || l.bike?.regNo || "",
      "Assigned Officer": l.officer,
      "Mileage (KM)": l.mileage,
      "Province": l.province,
      "District": l.district,
      "Work Done": l.workDone || "None",
      "Work Pending": l.workPending || "None",
      "Spares Used": l.spares && l.spares.length > 0 
        ? l.spares.map((s: any) => `${s.spareName} (${s.quantity})`).join(", ") 
        : "None",
      "Status": l.status.toUpperCase()
    }));

    const sparesData = sparesList.map(s => ({
      "Spare ID": s.id,
      "Item Name": s.name,
      "Current Stock Quantity": s.quantity,
      "Date Stocked": s.dateAdded,
      "Recorded By": s.addedBy
    }));

    const wb = XLSX.utils.book_new();
    const wsBikes = XLSX.utils.json_to_sheet(bikesData);
    const wsLogs = XLSX.utils.json_to_sheet(logsData);
    const wsSpares = XLSX.utils.json_to_sheet(sparesData);
    
    XLSX.utils.book_append_sheet(wb, wsBikes, "Bike Registry");
    XLSX.utils.book_append_sheet(wb, wsLogs, "Service Logs");
    XLSX.utils.book_append_sheet(wb, wsSpares, "Spares Stock");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };

  const handleBackupNow = async () => {
    if (!accessToken) return;
    setLoading(true);
    setSyncStatus({ type: "idle", message: "" });
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const timeStr = new Date().toLocaleTimeString().replace(/:/g, "-");
      
      // 1. Upload JSON Database Backup
      const jsonBlob = getJsonBackupBlob();
      const jsonBackupName = `eff_fleet_backup_${dateStr}_${timeStr}.json`;
      await uploadToDriveMultipart(jsonBackupName, "application/json", jsonBlob, accessToken);

      // 2. Upload Excel visual report
      const excelBlob = getExcelBackupBlob();
      const excelBackupName = `EFF_Zambia_Fleet_Report_${dateStr}_${timeStr}.xlsx`;
      await uploadToDriveMultipart(excelBackupName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBlob, accessToken);

      setSyncStatus({ 
        type: "success", 
        message: "Data backed up to Google Drive successfully. Uploaded both JSON Database and Excel Sheet!" 
      });
      await loadBackupsList(accessToken);
    } catch (err: any) {
      setSyncStatus({ type: "error", message: err.message || "Failed to backup data to Google Drive." });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
    if (!accessToken) return;
    
    // STRICT RULE: Ask for explicit confirmation before mutating or overwriting data
    const confirmed = window.confirm(
      `CRITICAL ACTION REQUIRED!\n\nAre you sure you want to restore MechLog Fleet Database from Google Drive backup: "${fileName}"?\n\nThis will merge restored data into your current fleet and inventory database. Active entries on your device will remain safe.`
    );
    if (!confirmed) return;

    setLoading(true);
    setSyncStatus({ type: "idle", message: "" });
    try {
      const restoreData = await downloadDriveFile(fileId, accessToken);
      if (!restoreData || !restoreData.bikes) {
        throw new Error("Invalid backup file format. Could not locate Fleet datasets.");
      }

      // RESTORING DATA USING BACKEND API CALLS (Smart Merge)
      const token = await user.getIdToken();
      let bikesMerged = 0;
      let sparesMerged = 0;
      let logsMerged = 0;

      // 1. Restore Bikes
      for (const b of restoreData.bikes) {
        // Check if registration already exists
        const exists = bikesList.some(item => item.regNo.toUpperCase() === b.regNo.toUpperCase());
        if (!exists) {
          const res = await fetch("/api/bikes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              regNo: b.regNo,
              province: b.province,
              district: b.district,
              model: b.model,
              officer: b.officer,
              dateAdded: b.dateAdded
            })
          });
          if (res.ok) bikesMerged++;
        }
      }

      // 2. Restore Spares
      for (const s of restoreData.spares) {
        const exists = sparesList.some(item => item.name.toLowerCase() === s.name.toLowerCase());
        if (!exists) {
          const res = await fetch("/api/spares", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              name: s.name,
              quantity: s.quantity,
              dateAdded: s.dateAdded
            })
          });
          if (res.ok) sparesMerged++;
        }
      }

      // 3. Restore Service Logs
      for (const l of restoreData.logs) {
        // Find corresponding bike ID mapping (since database IDs might change)
        const bikeInBackup = restoreData.bikes.find((b: any) => b.id === l.bikeId);
        if (bikeInBackup) {
          // Find real mapped ID in current list
          const currentBikes = [...bikesList];
          const mappedBike = currentBikes.find(b => b.regNo.toUpperCase() === bikeInBackup.regNo.toUpperCase());
          const finalBikeId = mappedBike ? mappedBike.id : null;

          if (finalBikeId) {
            const exists = logsList.some(item => item.bikeId === finalBikeId && item.date === l.date && item.mileage === l.mileage);
            if (!exists) {
              const res = await fetch("/api/logs", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                  bikeId: finalBikeId,
                  date: l.date,
                  nextServiceDate: l.nextServiceDate,
                  nextServiceMileage: l.nextServiceMileage,
                  mileage: l.mileage,
                  officer: l.officer,
                  province: l.province,
                  district: l.district,
                  workDone: l.workDone,
                  workPending: l.workPending,
                  status: l.status,
                  spares: l.spares ? l.spares.map((sp: any) => ({ spareId: sp.spareId, quantity: sp.quantity })) : []
                })
              });
              if (res.ok) logsMerged++;
            }
          }
        }
      }

      await onRefreshData();
      setSyncStatus({
        type: "success",
        message: `Restoration Complete! Merged: ${bikesMerged} new bikes, ${sparesMerged} spares, ${logsMerged} service logs cleanly into database.`
      });
    } catch (err: any) {
      setSyncStatus({ type: "error", message: err.message || "Failed to restore data from Google Drive." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (fileId: string, fileName: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm(`Are you sure you want to delete backup file "${fileName}" permanently from your Google Drive?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteDriveFile(fileId, accessToken);
      setSyncStatus({ type: "success", message: `Deleted backup "${fileName}" successfully.` });
      await loadBackupsList(accessToken);
    } catch (err: any) {
      setSyncStatus({ type: "error", message: err.message || "Failed to delete file from Drive." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="gdrive-sync-panel">
      {/* Panel Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Cloud className="w-6 h-6 animate-pulse-subtle" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Google Drive Cloud Storage</h3>
            <p className="text-[11px] text-slate-500">Back up and sync data securely to your Google Account</p>
          </div>
        </div>
        
        {googleUser ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition-colors bg-slate-100 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        ) : null}
      </div>

      {/* Panel Body */}
      <div className="p-6 space-y-6">
        {syncStatus.type !== "idle" && (
          <div className={`p-4 rounded-xl text-xs flex gap-3 ${
            syncStatus.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
              : "bg-rose-50 text-rose-800 border border-rose-100"
          }`}>
            <span className="text-sm font-bold">
              {syncStatus.type === "success" ? "✓" : "⚠"}
            </span>
            <p className="font-medium leading-relaxed">{syncStatus.message}</p>
          </div>
        )}

        {!googleUser ? (
          <div className="text-center py-6 px-4 border-2 border-dashed border-slate-200 rounded-xl max-w-md mx-auto">
            <Database className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800 text-sm">Save your data online</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
              Connect your Google Drive account so that you and other officers using the link can back up, sync, and see database records across all your devices.
            </p>
            
            <div className="mt-5 flex justify-center">
              {/* Official Google Material Sign-In Button */}
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="gsi-material-button flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl px-5 py-3 shadow-sm hover:shadow transition-all cursor-pointer font-semibold text-xs active:scale-98 disabled:opacity-50"
              >
                <div className="gsi-material-button-icon w-4 h-4 flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>Connect with Google Drive</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Connected Account status */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border border-blue-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 bg-blue-600 rounded-full text-white font-bold flex items-center justify-center uppercase text-sm">
                    {googleUser.email?.[0]}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400">Connected Account</p>
                  <p className="text-xs font-bold text-slate-800">{googleUser.displayName || googleUser.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackupNow}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/10 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  Backup Now
                </button>
              </div>
            </div>

            {/* Backups List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-slate-400" />
                  Cloud Backups found in Drive
                </h4>
                
                <button
                  onClick={() => loadBackupsList(accessToken!)}
                  disabled={loading}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {backups.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-100 rounded-xl">
                  <FileJson className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No MechLog backups found on Google Drive</p>
                  <p className="text-[10px] text-slate-400 mt-1">Click &quot;Backup Now&quot; above to create one.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {backups.map((bk) => (
                    <div 
                      key={bk.id} 
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileJson className="w-4 h-4 text-orange-500 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 truncate max-w-[180px]" title={bk.name}>{bk.name}</p>
                          <p className="text-[10px] text-slate-400">Created: {new Date(bk.createdTime).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreFromDrive(bk.id, bk.name)}
                          disabled={loading}
                          className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Restore and merge this backup data"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(bk.id, bk.name)}
                          disabled={loading}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Syncing Info Note */}
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 leading-relaxed flex gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 mt-0.5 animate-pulse-subtle" />
              <div>
                <span className="font-bold">Multi-device Collaboration Mode:</span> Everyone who uses this application can connect their Google Drive and click &quot;Restore&quot; on any JSON backup listed here. It will automatically merge all fleet motorcycle records, spare inventories, and service logs, making collaboration completely seamless!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
