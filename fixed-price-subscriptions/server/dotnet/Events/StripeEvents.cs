using System.Reflection;
using Stripe;

namespace dotnet.Events
{
    public delegate void StripeEvent(object source, Event e);

    public class StripeEvents
    {
        public static event StripeEvent Account_Updated;
        public static event StripeEvent Balance_Available;
        public static event StripeEvent Charge_Captured;
        public static event StripeEvent Charge_Dispute_Created;
        public static event StripeEvent Charge_Failed;
        public static event StripeEvent Charge_Refunded;
        public static event StripeEvent Charge_Succeeded;
        public static event StripeEvent Checkout_Session_AsyncPaymentFailed;
        public static event StripeEvent Checkout_Session_AsyncPaymentSucceeded;
        public static event StripeEvent Checkout_Session_Completed;
        public static event StripeEvent Customer_Created;
        public static event StripeEvent Customer_Deleted;
        public static event StripeEvent Customer_Updated;
        public static event StripeEvent Customer_Source_Created;
        public static event StripeEvent Customer_Source_Updated;
        public static event StripeEvent Customer_Subscription_Created;
        public static event StripeEvent Customer_Subscription_Deleted;
        public static event StripeEvent Customer_Subscription_TrialWillEnd;
        public static event StripeEvent Customer_Subscription_Updated;
        public static event StripeEvent Invoice_Created;
        public static event StripeEvent Invoice_Finalized;
        public static event StripeEvent Invoice_Paid;
        public static event StripeEvent Invoice_PaymentActionRequired;
        public static event StripeEvent Invoice_PaymentFailed;
        public static event StripeEvent Invoice_PaymentSucceeded;
        public static event StripeEvent Invoice_Updated;
        public static event StripeEvent IssuingAuthorization_Request;
        public static event StripeEvent IssuingCard_Created;
        public static event StripeEvent IssuingCardHolder_Created;
        public static event StripeEvent PaymentIntent_AmountCapturableUpdated;
        public static event StripeEvent PaymentIntent_Canceled;
        public static event StripeEvent PaymentIntent_Created;
        public static event StripeEvent PaymentIntent_PartiallyFunded;
        public static event StripeEvent PaymentIntent_PaymentFailed;
        public static event StripeEvent PaymentIntent_RequiresAction;
        public static event StripeEvent PaymentIntent_Succeeded;
        public static event StripeEvent PaymentLink_Created;
        public static event StripeEvent PaymentLink_Updated;
        public static event StripeEvent PaymentMethod_Attached;
        public static event StripeEvent Payout_Created;
        public static event StripeEvent Payout_Updated;
        public static event StripeEvent Plan_Created;
        public static event StripeEvent Plan_Deleted;
        public static event StripeEvent Plan_Updated;
        public static event StripeEvent Price_Created;
        public static event StripeEvent Price_Updated;
        public static event StripeEvent Product_Created;
        public static event StripeEvent Product_Deleted;
        public static event StripeEvent Product_Updated;
        public static event StripeEvent Quote_Accepted;
        public static event StripeEvent Quote_Canceled;
        public static event StripeEvent Quote_Created;
        public static event StripeEvent Quote_Finalized;
        public static event StripeEvent SetupIntent_Canceled;
        public static event StripeEvent SetupIntent_Created;
        public static event StripeEvent SetupIntent_SetupFailed;
        public static event StripeEvent SetupIntent_Succeeded;
        public static event StripeEvent SubscriptionSchedule_Canceled;
        public static event StripeEvent SubscriptionSchedule_Created;
        public static event StripeEvent SubscriptionSchedule_Released;
        public static event StripeEvent SubscriptionSchedule_Updated;

        public static void OnFireEvent(object sender, string eventName, Event e)
        {
            var backingField = typeof(StripeEvents).GetField(eventName, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Static);
            var delegateInstance = (StripeEvent)backingField.GetValue(null);
            delegateInstance?.Invoke(sender, e);
        }
    }
}
