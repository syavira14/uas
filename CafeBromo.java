import java.util.Scanner;
public class CafeBromo {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        // Array untuk menyimpan nama pesanan, harga, dan jumlah
        String[] orders = new String[100];
        int[] prices = new int[100];
        int[] quantities = new int[100]; 
        int orderCount = 0;

        System.out.println("===== Selamat Datang di Kafe Bromo Hills =====");
        System.out.println("\n==== Daftar Menu ====");
        System.out.println("1. Espresso    - Rp20000");
        System.out.println("2. Amricano    - Rp25000");
        System.out.println("3. Bromo Coffe - Rp30000");
        System.out.println("4. Kentang Goreng - Rp30000");
        System.out.println("5. Roti Bakar     - Rp20000");
        System.out.println("6. Cappuccino     - Rp20000");
        System.out.println("7. Creame Brule   - Rp25000");

        while (true) {
            System.out.println("\nPilih opsi berikut:");
            System.out.println("1. Tambah Pesanan");
            System.out.println("2. Lihat Daftar Pesanan");
            System.out.println("3. Hitung Total Biaya");
            System.out.println("4. Lakukan Pembayaran");
            System.out.println("5. Selesai");
            System.out.print("Masukkan pilihan Anda: ");
            int choice = scanner.nextInt();

            if (choice == 1) {
                System.out.print("Masukkan nomor menu yang ingin dipesan: ");
                int menuNumber = scanner.nextInt();
                System.out.print("Masukkan jumlah pesanan: ");
                int quantity = scanner.nextInt();

                // Menentukan nama pesanan dan harga berdasarkan nomor menu
                String orderName = "";
                int price = 0;
                switch (menuNumber) {
                    case 1:
                        orderName = "Espresso";
                        price = 20000;
                        break;
                    case 2:
                        orderName = "Americano";
                        price = 25000;
                        break;
                    case 3:
                        orderName = "Bromo Coffe";
                        price = 30000;
                        break;
                    case 4:
                        orderName = "Kentang Goreng";
                        price = 30000;
                        break;
                    case 5:
                        orderName = "Roti Bakar";
                        price = 20000;
                        break;
                    case 6:
                        orderName = "Cappuccino";
                        price = 30000;
                        break;
                    case 7:
                        orderName = "Cream brule";
                        price = 25000;
                        break;
                    default:
                        System.out.println("Menu tidak valid. Silakan coba lagi.");
                        continue;
                }

                // Menyimpan ke dalam array
                orders[orderCount] = orderName;
                prices[orderCount] = price;
                quantities[orderCount] = quantity;
                orderCount++;

                System.out.println(orderName + " berhasil ditambahkan ke pesanan.");
            } else if (choice == 2) {
                System.out.println("\n=== Daftar Pesanan ===");
                int totalCost = 0;
                for (int i = 0; i < orderCount; i++) {
                    int subtotal = prices[i] * quantities[i];
                    System.out.println(orders[i] + " x" + quantities[i] + " - Rp" + subtotal);
                    totalCost += subtotal;
                }
                System.out.println("Total Biaya: Rp" + totalCost);
            } else if (choice == 3) {
                int totalCost = 0;
                for (int i = 0; i < orderCount; i++) {
                    totalCost += prices[i] * quantities[i];
                }
                System.out.println("\nTotal Biaya dari Semua Pesanan: Rp" + totalCost);
            } else if (choice == 4) {
                // Sistem pembayaran
                int totalCost = 0;
                for (int i = 0; i < orderCount; i++) {
                    totalCost += prices[i] * quantities[i];
                }
                System.out.println("\n=== Pembayaran ===");
                System.out.println("Total Biaya: Rp" + totalCost);
                System.out.print("Masukkan jumlah uang yang dibayarkan: ");
                int payment = scanner.nextInt();

                while (payment < totalCost) {
                    System.out.println("Uang tidak mencukupi. Masukkan jumlah yang sesuai.");
                    System.out.print("Masukkan jumlah uang yang dibayarkan: ");
                    payment = scanner.nextInt();
                }

                int change = payment - totalCost;
                System.out.println("Pembayaran berhasil. Kembalian Anda: Rp" + change);
                System.out.println("Terima kasih telah memesan. Sampai jumpa!");
                break; // Program selesai setelah pembayaran
            } else if (choice == 5) {
                System.out.println("Terima kasih telah memesan. Sampai jumpa!");
                break;
            } else {
                System.out.println("Pilihan tidak valid. Silakan coba lagi.");
            }
        }

        scanner.close();
    }

 

}