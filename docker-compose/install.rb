examples = %w[fixed-price-subscriptions per-seat-subscriptions usage-based-subscriptions]
languages = %w[dotnet go java node php python ruby]
files = []

examples.each do |example|
  languages.each do |language|
    src = "docker-compose/#{language}.yml"
    dest = "#{example}/server/#{language}/docker-compose.yml"

    file dest => src do
      sh 'cp', src, dest
    end

    files << dest
  end
end

task 'docker-compose': files
