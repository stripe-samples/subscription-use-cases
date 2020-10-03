RSpec.describe "full integration path" do
  it "just works" do
    # Get the index html page
    response = get("/")
    expect(response).not_to be_nil
  end
end
