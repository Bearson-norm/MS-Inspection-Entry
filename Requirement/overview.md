Garis Besar

Sistem yang digunakan untuk melakukan screening hasil dari scan barcode, dimana ada 2 level yaitu green level dan red level dengan menggunakan web-app

Cara Kerja

Halaman utama adalah tampilan scan camera live seperti qris seperti pada reporitory "C:\Users\info\Documents\Project\not-released\IoT-Project\Released-Github\IoT-QR-Consumer" dimana prosesnya adalah security akan melakukan scan qr code  yang isinya adalah kode karyawan yang sudah diset levelnya. Jika level karyawan tersebut adalah green maka akan ada response 1 detik untuk menampilkan bahwa scan berhasil, jika level karyawan tersebut adalah red maka akan ada response 2 detik untuk menampilkan bahwa perlu dilakukan pemeriksaan pada karyawan tersebut

hasil dari data tersebut saya berharap bisa digabungkan dengan database repository IoT-QR-Consumer namun masuk ke tabel yang berbeda saja

Goals

1. Setiap scan akan ada response
2. Report log karyawan melakukan proses scan dalam 1 hari
3. Rekap log (data analyst bot ?)