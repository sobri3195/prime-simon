# Daftar Fitur Lengkap Prime Finance Simon

Dokumen ini merangkum seluruh fitur yang tersedia pada aplikasi berdasarkan konfigurasi navigasi (`src/data/menuConfig.ts`).

## 1) Dashboard
- **Overview Finance** (`dashboard`): Ringkasan KPI keuangan utama dalam satu tampilan.

## 2) Master Data
- **Profil Klinik** (`master-profile`): Pengaturan identitas klinik, legal entity, dan kode finance.
- **Dokter** (`master-doctors`): Master data dokter aktif, spesialisasi, dan tarif jasa standar.
- **Karyawan** (`master-employees`): Master data karyawan untuk payroll dan absensi.
- **Vendor** (`master-vendors`): Master supplier/vendor dan kategori.
- **Payer / Asuransi** (`master-payers`): Data penjamin, tipe payer, serta termin pembayaran.
- **COA** (`master-coa`): Chart of Accounts untuk posting transaksi dan pelaporan.
- **Cost Center** (`master-cost-center`): Pengelolaan unit biaya dan budgeting.
- **Tarif Pajak** (`master-tax`): Master tarif pajak yang dipakai lintas modul.
- **Kategori Layanan** (`master-service-category`): Mapping layanan ke departemen dan akun pendapatan.

## 3) Pendapatan
- **Input Pendapatan Harian** (`daily-revenue`): Input transaksi pendapatan harian.
- **Detail Pendapatan** (`revenue`): Rincian pendapatan berdasarkan data transaksi.
- **Ranking Dokter** (`doctor-ranking`): Peringkat kontribusi pendapatan per dokter.
- **Report Highlight** (`highlight`): Sorotan indikator pendapatan utama.
- **Pendapatan Kasir Harian** (`cashier`): Rekap pendapatan per kasir/per hari.
- **Kartu Debit / Kredit** (`debit-credit-card`): Monitoring transaksi pembayaran kartu.

## 4) Dokter & Honor
- **Input Jasa Medis** (`doctor-fee`): Input komponen jasa medis dokter.
- **Rekap Jasa Medis Dokter** (`doctor-fee-recap`): Rekap akumulasi jasa medis.
- **Potongan Jasa Dokter** (`doctor-deduction`): Pengelolaan potongan honor dokter.
- **Pembayaran Honor Dokter** (`doctor-payment`): Proses pembayaran jasa/honor dokter.
- **PPh Honor Dokter** (`doctor-tax`): Perhitungan pajak atas honor dokter.

## 5) Pengajuan & Voucher
- **Pembayaran Vendor** (`payment-request`): Pengajuan dan proses pembayaran vendor.
- **Kas Kecil** (`petty-cash`): Permintaan dan pengelolaan kas kecil.
- **Voucher BBK** (`voucher-bbk`): Voucher bukti bank keluar.
- **Voucher BKK** (`voucher-bkk`): Voucher bukti kas keluar.
- **Voucher Kas Kecil** (`voucher-kk`): Voucher transaksi kas kecil.
- **Penerimaan Kas Kecil** (`voucher-kkm`): Pencatatan penerimaan kembali kas kecil.
- **Bukti Setor Bank** (`setor-bank`): Pencatatan setoran dana ke bank.

## 6) Piutang & Hutang
- **Aging Piutang** (`ar`): Analisis umur piutang.
- **Aging Hutang** (`ap`): Analisis umur hutang vendor.
- **Surat Penagihan Asuransi** (`collection-letter`): Pembuatan surat tagihan ke payer/asuransi.

## 7) Persediaan
- **Master Persediaan** (`inventory-master`): Master item persediaan.
- **Mutasi Persediaan** (`inventory-mutation`): Pencatatan pergerakan stok.
- **Laporan Persediaan Average** (`inventory`): Laporan nilai/stok metode average.

## 8) Aset Tetap
- **Master Aset** (`asset-master`): Master data aset tetap.
- **Penyusutan Aset** (`asset-depreciation`): Perhitungan depresiasi aset.
- **Laporan Aset by Cost Center** (`assets`): Distribusi aset per cost center.

## 9) Pajak
- **PPh 21 / 23** (`tax`): Rekap/perhitungan PPh 21 dan 23.
- **PPh Honor Dokter** (`doctor-tax-page`): Modul pajak khusus honor dokter.
- **PPN Prepopulated** (`ppn`): Pengelolaan data PPN prepopulated.
- **Rekap Pajak Bulanan** (`tax-summary`): Ringkasan pajak bulanan.

## 10) Payroll
- **Absensi** (`attendance`): Data kehadiran karyawan.
- **Rekap Gaji** (`payroll`): Perhitungan dan rekap gaji periodik.
- **Slip Gaji** (`payroll-slip`): Generate/cetak slip gaji karyawan.

## 11) Laporan Keuangan
- **Laba Rugi** (`pl`): Laporan profit and loss.
- **Laba Rugi by Payer** (`pl-payer`): Laba rugi berdasarkan kelompok payer.
- **Neraca** (`balance`): Laporan posisi keuangan.
- **Perubahan Modal** (`equity`): Laporan perubahan ekuitas.
- **Arus Kas** (`cashflow`): Laporan cash flow.
- **RAB vs Realisasi** (`budget`): Perbandingan anggaran dan realisasi.

## 12) Utility
- **Import / Export** (`utility`): Utilitas impor-ekspor data.
- **Audit Trail** (`audit-trail`): Jejak audit aktivitas/modifikasi data.
- **Rekonsiliasi** (`reconciliation`): Rekonsiliasi data keuangan.
- **Settings** (`settings`): Pengaturan aplikasi.
- **Reset Data** (`reset-data`): Reset data aplikasi.

---

## Ringkasan Total Fitur
- **Total grup menu:** 12
- **Total fitur/menu:** 56

