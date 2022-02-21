using System.Linq;

namespace dotnet.Extensions
{
	public static class StringExtensions
	{
		public static string ToFirstUpper(this string s)
		{
			return string.Concat(
				s.Substring(0, 1).ToUpper(),
				s.Substring(1, s.Length - 1));
		}

		public static string ToEventHandler(this string s)
		{
			return string.Join("_",
				s.Split('.')
					.Select(part => string.Join("", part.Split('_')
						.Select(word => word.ToFirstUpper()))));
		}
	}
}
