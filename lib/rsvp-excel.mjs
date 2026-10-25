import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// This workbook is a private snapshot; the database remains the source of truth.
export function createRsvpExcelExporter({ readRows, filename }) {
  let queue = Promise.resolve();
  let retry;
  async function writeSnapshot() {
    const rows = readRows();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Syahrul & Suhaila RSVP';
    workbook.created = new Date();
    const summary = workbook.addWorksheet('Ringkasan');
    summary.columns = [{ width: 35 }, { width: 26 }];
    summary.addRows([
      ['RSVP · Syahrul & Suhaila', '8 November 2026'],
      ['Dikemas kini (Malaysia)', new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())],
      ['Jumlah tetamu akan hadir', rows.reduce((total, row) => total + (row.attendance === 'Hadir' ? Number(row.pax) || 0 : 0), 0)],
      ['Jumlah jawapan RSVP', rows.length],
      ['Jawapan hadir', rows.filter(row => row.attendance === 'Hadir').length],
      ['Jawapan tidak hadir', rows.filter(row => row.attendance === 'Tidak hadir').length],
      ['Jumlah mesej', rows.filter(row => String(row.wish || '').trim()).length],
      ['Nota', 'Bilangan tetamu termasuk pengirim. Fail dikemas kini oleh server; perubahan manual akan diganti.'],
    ]);
    summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAA7E91' } };
    summary.getRow(1).height = 30;
    summary.getRow(8).alignment = { wrapText: true, vertical: 'top' };
    summary.getRow(8).height = 60;
    summary.getCell('B3').font = { bold: true, size: 18, color: { argb: 'FF85576B' } };
    const guests = workbook.addWorksheet('Senarai RSVP', { views: [{ state: 'frozen', ySplit: 1 }] });
    guests.columns = [
      { header: 'Nama', key: 'name', width: 30 },
      { header: 'Kehadiran', key: 'attendance', width: 18 },
      { header: 'Bilangan tetamu', key: 'pax', width: 20 },
      { header: 'Mesej / ucapan', key: 'wish', width: 65 },
      { header: 'Izin papar ucapan', key: 'visible', width: 21 },
      { header: 'Tarikh (Malaysia)', key: 'date', width: 26 },
    ];
    for (const row of rows) guests.addRow({
      name: String(row.name || ''), attendance: String(row.attendance || ''),
      pax: row.attendance === 'Hadir' ? Number(row.pax) || 0 : 0,
      wish: String(row.wish || ''), visible: row.visible ? 'Ya' : 'Tidak',
      date: new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(row.created_at)),
    });
    guests.autoFilter = { from: 'A1', to: 'F1' };
    guests.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guests.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAA7E91' } };
    guests.getRow(1).height = 26;
    guests.eachRow(row => { row.alignment = { wrapText: true, vertical: 'top' }; });
    const folder = path.dirname(filename);
    await fs.mkdir(folder, { recursive: true, mode: 0o700 });
    const temp = filename + '.tmp';
    const bytes = await workbook.xlsx.writeBuffer();
    await fs.writeFile(temp, bytes, { mode: 0o600 });
    await fs.rename(temp, filename);
  }
  return function refreshExcel() {
    queue = queue.catch(() => {}).then(writeSnapshot);
    return queue.catch(error => {
      console.error('RSVP saved; Excel snapshot could not update:', error.message);
      if (!retry) {
        retry = setTimeout(() => { retry = undefined; refreshExcel(); }, 30_000);
        retry.unref();
      }
      return false;
    });
  };
}
