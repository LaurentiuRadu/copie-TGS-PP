import { useState, useEffect } from 'react';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Clock, Trash2, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function NotificationTestPanel() {
  const {
    isNativePlatform,
    permissionStatus,
    requestPermissions,
    checkPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getPendingNotifications,
  } = useLocalNotifications();

  const [pendingCount, setPendingCount] = useState(0);

  // Load pending notifications count
  const loadPendingCount = async () => {
    const pending = await getPendingNotifications();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    checkPermissions();
    loadPendingCount();
  }, [checkPermissions]);

  const handleSchedule5s = async () => {
    const scheduleTime = new Date(Date.now() + 5000);
    await scheduleNotification({
      id: Math.floor(Math.random() * 1000000),
      title: "Test Notificare 5s",
      body: "Această notificare a fost programată cu 5 secunde în urmă",
      scheduleAt: scheduleTime,
      extra: { type: 'test', duration: '5s' },
    });
    await loadPendingCount();
  };

  const handleSchedule10s = async () => {
    const scheduleTime = new Date(Date.now() + 10000);
    await scheduleNotification({
      id: Math.floor(Math.random() * 1000000),
      title: "Test Notificare 10s",
      body: "Această notificare a fost programată cu 10 secunde în urmă",
      scheduleAt: scheduleTime,
      extra: { type: 'test', duration: '10s' },
    });
    await loadPendingCount();
  };

  const handleSchedule30s = async () => {
    const scheduleTime = new Date(Date.now() + 30000);
    await scheduleNotification({
      id: Math.floor(Math.random() * 1000000),
      title: "Reminder Clock-Out",
      body: "Nu uita să faci clock-out la sfârșitul programului!",
      scheduleAt: scheduleTime,
      extra: { type: 'clock-out-reminder' },
    });
    await loadPendingCount();
  };

  const handleCancelAll = async () => {
    await cancelAllNotifications();
    await loadPendingCount();
  };

  const handleRequestPermissions = async () => {
    await requestPermissions();
    await checkPermissions();
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">✅ Permis</Badge>;
      case 'denied':
        return <Badge variant="destructive">❌ Refuzat</Badge>;
      case 'prompt':
        return <Badge variant="secondary">⏳ Nesolicitat</Badge>;
      default:
        return <Badge variant="outline">❓ Necunoscut</Badge>;
    }
  };

  const getPlatformBadge = () => {
    if (isNativePlatform) {
      return <Badge variant="default" className="bg-blue-500">📱 Native (Android/iOS)</Badge>;
    }
    return <Badge variant="outline">🌐 Web (Simulat)</Badge>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Local Notifications - Test Panel
        </CardTitle>
        <CardDescription>
          Testează funcționalitatea notificărilor locale pe dispozitive mobile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Status</h3>
          <div className="flex flex-wrap gap-2">
            {getPlatformBadge()}
            {getPermissionBadge()}
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              {pendingCount} programate
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Permissions Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permisiuni
          </h3>
          <Button 
            onClick={handleRequestPermissions} 
            variant="outline" 
            className="w-full"
            disabled={!isNativePlatform || permissionStatus === 'granted'}
          >
            {permissionStatus === 'granted' ? '✅ Permisiuni acordate' : 'Solicită permisiuni'}
          </Button>
        </div>

        <Separator />

        {/* Schedule Notifications Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Programează Notificări
          </h3>
          <div className="grid grid-cols-1 gap-2">
            <Button 
              onClick={handleSchedule5s} 
              variant="default"
              className="w-full"
            >
              🔔 Test 5 secunde
            </Button>
            <Button 
              onClick={handleSchedule10s} 
              variant="default"
              className="w-full"
            >
              🔔 Test 10 secunde
            </Button>
            <Button 
              onClick={handleSchedule30s} 
              variant="default"
              className="w-full"
            >
              ⏰ Reminder Clock-Out (30s)
            </Button>
          </div>
        </div>

        <Separator />

        {/* Cancel Notifications Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            Anulare Notificări
          </h3>
          <Button 
            onClick={handleCancelAll} 
            variant="destructive"
            className="w-full"
            disabled={pendingCount === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Anulează toate ({pendingCount})
          </Button>
        </div>

        {!isNativePlatform && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Web Platform Detected:</strong> Notificările locale funcționează doar pe dispozitive Android/iOS. 
              Rulează <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">npx cap run android</code> pentru a testa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
