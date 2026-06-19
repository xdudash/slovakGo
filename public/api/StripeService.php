<?php
declare(strict_types=1);

class StripeService {
    private SQLite3 $db;

    public function __construct(SQLite3 $db) {
        $this->db = $db;
    }

    public static function loadSdk(): void {
        $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (!file_exists($autoload)) {
            http_response_code(503);
            echo json_encode(['error' => 'Stripe SDK not found. Run: composer require stripe/stripe-php']);
            exit;
        }
        require_once $autoload;
        \Stripe\Stripe::setApiKey((string)getenv('STRIPE_SECRET_KEY'));
    }

    public function createCheckoutSession(string $uid): string {
        self::loadSdk();
        $stmt = $this->db->prepare('SELECT email, stripe_customer_id FROM users WHERE id = ? LIMIT 1');
        $stmt->bindValue(1, $uid);
        $res = $stmt->execute();
        $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
        if (!$row) throw new Exception('User not found', 404);

        $priceId = (string)getenv('STRIPE_PRICE_ID');
        if ($priceId === '') throw new Exception('STRIPE_PRICE_ID not configured', 503);

        $appUrl = rtrim((string)(getenv('APP_URL') ?: 'http://localhost:5173'), '/');
        
        $params = [
            'mode'                  => 'subscription',
            'client_reference_id'   => $uid,
            'line_items'            => [['price' => $priceId, 'quantity' => 1]],
            'success_url'           => $appUrl . '/app/shop?subscribed=1',
            'cancel_url'            => $appUrl . '/app/shop',
            'allow_promotion_codes' => true,
            'metadata'              => [
                'app_user_id' => $uid
            ],
            'subscription_data' => [
                'metadata' => [
                    'app_user_id' => $uid
                ]
            ]
        ];

        $customerId = (string)($row['stripe_customer_id'] ?? '');
        if ($customerId !== '') {
            $params['customer'] = $customerId;
        } else {
            $params['customer_email'] = (string)$row['email'];
        }

        $session = \Stripe\Checkout\Session::create($params);
        return $session->url;
    }

    public function createPortalSession(string $uid): string {
        self::loadSdk();
        $stmt = $this->db->prepare('SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1');
        $stmt->bindValue(1, $uid);
        $res = $stmt->execute();
        $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
        $customerId = (string)($row['stripe_customer_id'] ?? '');
        
        if ($customerId === '') throw new Exception('Billing account not found', 404);

        $appUrl = rtrim((string)(getenv('APP_URL') ?: 'http://localhost:5173'), '/');
        $session = \Stripe\BillingPortal\Session::create([
            'customer'   => $customerId,
            'return_url' => $appUrl . '/app/shop',
        ]);
        return $session->url;
    }

    public function handleWebhook(string $payload, string $sig): void {
        self::loadSdk();
        $secret = (string)getenv('STRIPE_WEBHOOK_SECRET');

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sig, $secret);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid signature: ' . $e->getMessage()]);
            exit;
        }

        $obj = $event->data->object;
        $now = gmdate('Y-m-d\TH:i:s\Z');

        switch ($event->type) {
            case 'checkout.session.completed':
                $this->handleCheckoutCompleted($obj, $now);
                break;

            case 'invoice.payment_succeeded':
                $this->handlePaymentSucceeded($obj, $now);
                break;

            case 'invoice.payment_failed':
                $this->handlePaymentFailed($obj, $now);
                break;

            case 'customer.subscription.updated':
                $this->handleSubscriptionUpdated($obj, $now);
                break;

            case 'customer.subscription.deleted':
                $this->handleSubscriptionDeleted($obj, $now);
                break;
        }
    }

    private function handleCheckoutCompleted($session, string $now): void {
        $uid = (string)($session->client_reference_id ?? $session->metadata->app_user_id ?? '');
        if ($uid === '') return;

        $customerId = (string)$session->customer;
        $subId = (string)$session->subscription;

        $stmt = $this->db->prepare('UPDATE users SET sub_status = "plus", stripe_customer_id = ?, stripe_sub_id = ?, updated_at = ? WHERE id = ?');
        $stmt->bindValue(1, $customerId);
        $stmt->bindValue(2, $subId);
        $stmt->bindValue(3, $now);
        $stmt->bindValue(4, $uid);
        $stmt->execute();
    }

    private function handlePaymentSucceeded($invoice, string $now): void {
        $subId = (string)$invoice->subscription;
        if (!$subId) return;

        $stmt = $this->db->prepare('UPDATE users SET sub_status = "plus", updated_at = ? WHERE stripe_sub_id = ?');
        $stmt->bindValue(1, $now);
        $stmt->bindValue(2, $subId);
        $stmt->execute();
    }

    private function handlePaymentFailed($invoice, string $now): void {
        $subId = (string)$invoice->subscription;
        if (!$subId) return;

        // Optionally send a push notification here
        $this->notifyUser($subId, 'Оплата не пройшла', 'Твоя підписка Plus призупинена. Будь ласка, перевір карту.');

        $stmt = $this->db->prepare('UPDATE users SET sub_status = "expired", updated_at = ? WHERE stripe_sub_id = ?');
        $stmt->bindValue(1, $now);
        $stmt->bindValue(2, $subId);
        $stmt->execute();
    }

    private function handleSubscriptionUpdated($subscription, string $now): void {
        $status = $subscription->status === 'active' ? 'plus' : 'free';
        $subId = (string)$subscription->id;

        $stmt = $this->db->prepare('UPDATE users SET sub_status = ?, updated_at = ? WHERE stripe_sub_id = ?');
        $stmt->bindValue(1, $status);
        $stmt->bindValue(2, $now);
        $stmt->bindValue(3, $subId);
        $stmt->execute();
    }

    private function handleSubscriptionDeleted($subscription, string $now): void {
        $subId = (string)$subscription->id;

        $stmt = $this->db->prepare('UPDATE users SET sub_status = "free", stripe_sub_id = "", updated_at = ? WHERE stripe_sub_id = ?');
        $stmt->bindValue(1, $now);
        $stmt->bindValue(2, $subId);
        $stmt->execute();
    }

    private function notifyUser(string $subId, string $title, string $body): void {
        // Find user by subscription ID
        $stmt = $this->db->prepare('SELECT id FROM users WHERE stripe_sub_id = ? LIMIT 1');
        $stmt->bindValue(1, $subId);
        $res = $stmt->execute();
        $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
        if (!$row) return;

        $uid = (string)$row['id'];
        
        // Find FCM token
        $stmt = $this->db->prepare('SELECT token FROM fcm_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->bindValue(1, $uid);
        $res = $stmt->execute();
        $row = $res ? $res->fetchArray(SQLITE3_ASSOC) : false;
        
        if ($row && !empty($row['token'])) {
            // fcm_send is a global function in index.php
            if (function_exists('fcm_send')) {
                fcm_send((string)$row['token'], $title, $body, ['tag' => 'billing']);
            }
        }
    }
}
