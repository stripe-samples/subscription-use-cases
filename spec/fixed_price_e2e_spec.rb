require 'capybara_support'

RSpec.describe 'Fixed price subscription', type: :system do
  before do
    visit server_url('/')

    expect(page).to have_selector('body')
    click_on 'Start Demo' if page.has_link?('Start Demo', wait: false) # for client/vanillajs
  end

  example 'happy path' do
    fill_in :email, with: 'test@example.com'
    fill_in :name, with: 'Jenny Rosen'
    click_on 'Register'

    within first('.price-list > div') do
      click_on 'Select'
    end

    fill_in :name, with: 'Jenny Rosen'

    within_frame find('form iframe') do
      fill_in 'cardnumber', with: '4242424242424242'
      fill_in 'exp-date', with: '12 / 33'
      fill_in 'cvc', with: '123'
      fill_in 'postal', with: '10000'
    end

    click_on 'Subscribe'

    expect(page).to have_content 'Subscriptions'
    expect(page).to have_content 'Status: active'

    click_on 'Cancel'

    expect(page).to have_content 'Cancel'
    click_on 'Cancel'

    expect(page).to have_content 'Subscriptions'
    expect(page).to have_content 'Status: canceled'
  end

  example 'with the test card that requires SCA' do
    fill_in :email, with: 'test@example.com'
    fill_in :name, with: 'Jenny Rosen'
    click_on 'Register'

    within first('.price-list > div') do
      click_on 'Select'
    end

    fill_in :name, with: 'Jenny Rosen'

    within_frame find('form iframe') do
      fill_in 'cardnumber', with: '4000002500003155'
      fill_in 'exp-date', with: '12 / 33'
      fill_in 'cvc', with: '123'
      fill_in 'postal', with: '10000'
    end

    click_on 'Subscribe'

    within_frame first('form iframe') do
      within_frame first('iframe') do
        within_frame first('iframe') do
          click_on 'Complete authentication'
        end
      end
    end

    expect(page).to have_content 'Subscriptions'
    expect(page).to have_content 'Status: active'
  end
end
