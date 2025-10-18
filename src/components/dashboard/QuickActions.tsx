import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, FileText, Settings, Bell, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Gestionare Useri',
      icon: Users,
      onClick: () => navigate('/admin/users'),
      color: 'text-primary',
    },
    {
      label: 'Programări',
      icon: Calendar,
      onClick: () => navigate('/admin/schedules'),
      color: 'text-success',
    },
    {
      label: 'Verificare Pontaje',
      icon: FileText,
      onClick: () => navigate('/admin/verification'),
      color: 'text-warning',
    },
    {
      label: 'Locații Lucru',
      icon: MapPin,
      onClick: () => navigate('/admin/locations'),
      color: 'text-info',
    },
    {
      label: 'Alerte Securitate',
      icon: Bell,
      onClick: () => navigate('/admin'),
      color: 'text-destructive',
    },
    {
      label: 'Setări',
      icon: Settings,
      onClick: () => navigate('/settings'),
      color: 'text-muted-foreground',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acțiuni Rapide</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto flex-col gap-2 p-4"
              onClick={action.onClick}
            >
              <action.icon className={`h-6 w-6 ${action.color}`} />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
