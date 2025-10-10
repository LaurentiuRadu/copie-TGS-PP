import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ScheduleEntry {
  id: string;
  team_id: string;
  week_start_date: string;
  user_id: string;
  day_of_week: number;
  shift_type: string;
  location: string | null;
  activity: string | null;
  vehicle: string | null;
  observations: string | null;
  team_leader_id: string | null;
  coordinator_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
}

const DAYS_OF_WEEK = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export const exportWeeklyScheduleToPDF = (
  schedules: ScheduleEntry[],
  weekStart: string,
  profiles: Profile[],
  teamFilter?: string
) => {
  const doc = new jsPDF();
  
  // Filter schedules by team if specified
  const filteredSchedules = teamFilter 
    ? schedules.filter(s => s.team_id === teamFilter)
    : schedules;

  // Calculate week end date
  const weekStartDate = new Date(weekStart);
  const weekEndDate = addDays(weekStartDate, 6);
  const weekNumber = format(weekStartDate, 'I', { locale: ro });
  
  // Title
  doc.setFontSize(16);
  doc.setFont('times', 'bold');
  doc.text('PROGRAMARE SĂPTĂMÂNALĂ', 105, 15, { align: 'center' });
  
  // Week info
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(
    `Săptămâna ${weekNumber}: ${format(weekStartDate, 'dd.MM.yyyy')} - ${format(weekEndDate, 'dd.MM.yyyy')}`,
    105,
    22,
    { align: 'center' }
  );
  doc.text(
    `Generat: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
    105,
    28,
    { align: 'center' }
  );

  let yPosition = 35;

  // Group schedules by team
  const teamMap = new Map<string, ScheduleEntry[]>();
  filteredSchedules.forEach(schedule => {
    if (!teamMap.has(schedule.team_id)) {
      teamMap.set(schedule.team_id, []);
    }
    teamMap.get(schedule.team_id)!.push(schedule);
  });

  // Sort teams
  const sortedTeams = Array.from(teamMap.keys()).sort((a, b) => {
    const numA = parseInt(a.replace('E', ''));
    const numB = parseInt(b.replace('E', ''));
    return numA - numB;
  });

  sortedTeams.forEach((teamId, teamIndex) => {
    const teamSchedules = teamMap.get(teamId)!;
    
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 15;
    }

    // Team header
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(14, yPosition, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text(`ECHIPA ${teamId}`, 16, yPosition + 5.5);
    yPosition += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('times', 'normal');

    // Get team info
    const sampleSchedule = teamSchedules[0];
    const coordinator = profiles.find(p => p.id === sampleSchedule.coordinator_id);
    const teamLeader = profiles.find(p => p.id === sampleSchedule.team_leader_id);
    
    // Get unique vehicles for this team
    const vehicles = [...new Set(teamSchedules.map(s => s.vehicle).filter(Boolean))].join(', ');

    doc.text(`Manager Proiect: ${coordinator?.full_name || coordinator?.username || '-'}`, 16, yPosition);
    yPosition += 5;
    doc.text(`Șef Echipă: ${teamLeader?.full_name || teamLeader?.username || '-'}`, 16, yPosition);
    yPosition += 5;
    doc.text(`Mașini alocate: ${vehicles || '-'}`, 16, yPosition);
    yPosition += 8;

    // Group by day
    const dayMap = new Map<number, ScheduleEntry[]>();
    for (let day = 1; day <= 7; day++) {
      dayMap.set(day, teamSchedules.filter(s => s.day_of_week === day));
    }

    // Iterate through days
    for (let day = 1; day <= 7; day++) {
      const daySchedules = dayMap.get(day) || [];
      
      if (daySchedules.length === 0) continue;

      // Check if we need a new page
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 15;
      }

      const dayDate = addDays(weekStartDate, day - 1);
      const dayName = DAYS_OF_WEEK[day - 1];
      
      // Day header
      doc.setFillColor(229, 231, 235); // Gray
      doc.rect(14, yPosition, 182, 6, 'F');
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${dayName}, ${format(dayDate, 'dd.MM.yyyy')}`, 16, yPosition + 4.5);
      yPosition += 8;

      // Prepare table data
      const tableData = daySchedules.map(schedule => {
        const employee = profiles.find(p => p.id === schedule.user_id);
        const employeeName = employee?.full_name || employee?.username || 'Necunoscut';
        const username = employee?.username || '';
        
        return [
          `${employeeName}${username ? ` (${username})` : ''}`,
          schedule.location || '-',
          schedule.activity || '-',
          schedule.vehicle || '-',
          schedule.shift_type === 'zi' ? 'Zi' : 'Noapte',
          schedule.observations || '-'
        ];
      });

      // Draw table
      autoTable(doc, {
        startY: yPosition,
        head: [['Angajat', 'Locație', 'Proiect', 'Mașină', 'Tură', 'Observații']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          font: 'times',
        },
        headStyles: {
          fillColor: [99, 102, 241], // Indigo
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Angajat
          1: { cellWidth: 30 }, // Locație
          2: { cellWidth: 35 }, // Proiect
          3: { cellWidth: 25 }, // Mașină
          4: { cellWidth: 15 }, // Tură
          5: { cellWidth: 37 }, // Observații
        },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 5;
    }

    yPosition += 5; // Space between teams
  });

  // Save PDF
  const fileName = teamFilter 
    ? `Programare_Echipa_${teamFilter}_Saptamana_${weekNumber}_${format(weekStartDate, 'dd-MM-yyyy')}.pdf`
    : `Programare_Completa_Saptamana_${weekNumber}_${format(weekStartDate, 'dd-MM-yyyy')}.pdf`;
  
  doc.save(fileName);
};
